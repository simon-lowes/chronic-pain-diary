-- Migration: Create trackers table and link pain_entries
-- Phase 1: Foundation Refactor for Baseline

-- =============================================================================
-- 1. Create trackers table
-- =============================================================================
CREATE TABLE IF NOT EXISTS trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'custom', -- 'preset' or 'custom'
  preset_id TEXT, -- null for custom, 'chronic_pain', 'mood', etc. for presets
  icon TEXT NOT NULL DEFAULT 'activity',
  color TEXT NOT NULL DEFAULT '#6366f1', -- indigo-500
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 2. Enable RLS on trackers
-- =============================================================================
ALTER TABLE trackers ENABLE ROW LEVEL SECURITY;

-- Users can only see their own trackers
CREATE POLICY "Users can view own trackers" ON trackers
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own trackers
CREATE POLICY "Users can insert own trackers" ON trackers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own trackers
CREATE POLICY "Users can update own trackers" ON trackers
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can only delete their own trackers
CREATE POLICY "Users can delete own trackers" ON trackers
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 3. Add tracker_id to pain_entries
-- =============================================================================
ALTER TABLE pain_entries 
  ADD COLUMN IF NOT EXISTS tracker_id UUID REFERENCES trackers(id) ON DELETE CASCADE;

-- =============================================================================
-- 4. Create default "Chronic Pain" tracker for existing users and migrate entries
-- =============================================================================

-- Single source of truth for default tracker creation (DRY)
CREATE OR REPLACE FUNCTION create_default_tracker(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_tracker_id UUID;
BEGIN
  INSERT INTO trackers (user_id, name, type, preset_id, icon, color, is_default)
  VALUES (
    p_user_id, 
    'Chronic Pain', 
    'preset', 
    'chronic_pain',
    'activity',
    '#ef4444', -- red-500
    true
  )
  RETURNING id INTO v_tracker_id;
  
  RETURN v_tracker_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to migrate existing users to trackers
CREATE OR REPLACE FUNCTION migrate_user_to_trackers(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_tracker_id UUID;
BEGIN
  -- Check if user already has a default tracker
  SELECT id INTO v_tracker_id 
  FROM trackers 
  WHERE user_id = p_user_id AND is_default = true
  LIMIT 1;
  
  -- If no default tracker exists, create one
  IF v_tracker_id IS NULL THEN
    v_tracker_id := create_default_tracker(p_user_id);
  END IF;
  
  -- Migrate all entries without a tracker_id to the default tracker
  UPDATE pain_entries 
  SET tracker_id = v_tracker_id 
  WHERE user_id = p_user_id AND tracker_id IS NULL;
  
  RETURN v_tracker_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migrate all existing users
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM pain_entries WHERE tracker_id IS NULL
  LOOP
    PERFORM migrate_user_to_trackers(r.user_id);
  END LOOP;
END $$;

-- =============================================================================
-- 5. Create trigger to auto-create default tracker for new users
-- =============================================================================
CREATE OR REPLACE FUNCTION create_default_tracker_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_default_tracker(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_tracker'
  ) THEN
    CREATE TRIGGER on_auth_user_created_tracker
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION create_default_tracker_for_new_user();
  END IF;
END $$;

-- =============================================================================
-- 6. Add index for performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_trackers_user_id ON trackers(user_id);
CREATE INDEX IF NOT EXISTS idx_pain_entries_tracker_id ON pain_entries(tracker_id);

-- =============================================================================
-- 7. Add updated_at trigger for trackers
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_trackers_updated_at ON trackers;
CREATE TRIGGER set_trackers_updated_at
  BEFORE UPDATE ON trackers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
