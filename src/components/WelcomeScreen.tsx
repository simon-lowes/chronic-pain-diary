/**
 * WelcomeScreen Component
 * 
 * Onboarding screen for new users who have no trackers yet.
 * Combines app introduction with immediate tracker creation.
 */

import { useState } from 'react';
import { Activity, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { TRACKER_PRESETS } from '@/types/tracker';
import type { Tracker, TrackerPresetId } from '@/types/tracker';
import type { GeneratedTrackerConfig } from '@/types/generated-config';
import { tracker as trackerService } from '@/runtime/appRuntime';
import { generateTrackerConfig, getGenericConfig } from '@/services/configGenerationService';
import { toast } from 'sonner';

interface WelcomeScreenProps {
  onTrackerCreated: (tracker: Tracker) => void;
}

export function WelcomeScreen({ onTrackerCreated }: Readonly<WelcomeScreenProps>) {
  const [customName, setCustomName] = useState('');
  const [creating, setCreating] = useState(false);
  const [creatingPreset, setCreatingPreset] = useState<TrackerPresetId | null>(null);

  async function handlePresetClick(presetId: TrackerPresetId) {
    const preset = TRACKER_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    setCreatingPreset(presetId);
    try {
      const result = await trackerService.createTracker({
        name: preset.name,
        type: 'preset',
        preset_id: presetId,
        icon: preset.icon,
        color: preset.color,
        is_default: true,
      });

      if (result.error) {
        toast.error('Failed to create tracker');
        console.error(result.error);
        return;
      }

      if (result.data) {
        toast.success(`${preset.name} tracker created!`);
        onTrackerCreated(result.data);
      }
    } catch (err) {
      console.error('Failed to create preset tracker:', err);
      toast.error('Something went wrong');
    } finally {
      setCreatingPreset(null);
    }
  }

  async function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = customName.trim();
    if (!name) return;

    setCreating(true);
    try {
      // Try AI generation first
      let generatedConfig: GeneratedTrackerConfig | null = null;
      try {
        const result = await generateTrackerConfig(name);
        if (result.success && result.config) {
          generatedConfig = result.config;
        }
      } catch {
        // Fall back to generic config if AI fails
      }
      
      // Use generic config as fallback
      if (!generatedConfig) {
        generatedConfig = getGenericConfig(name);
      }

      const result = await trackerService.createTracker({
        name,
        type: 'custom',
        icon: 'activity',
        color: '#6366f1',
        is_default: true,
        generated_config: generatedConfig,
      });

      if (result.error) {
        toast.error('Failed to create tracker');
        console.error(result.error);
        return;
      }

      if (result.data) {
        toast.success(`${name} tracker created!`);
        onTrackerCreated(result.data);
      }
    } catch (err) {
      console.error('Failed to create custom tracker:', err);
      toast.error('Something went wrong');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl mx-auto text-center space-y-8">
        {/* Logo and tagline */}
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
            <Activity className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">
            Baseline
          </h1>
          <p className="text-xl text-muted-foreground">
            Know your baseline, spot the changes.
          </p>
        </div>

        {/* Description */}
        <div className="space-y-2 text-muted-foreground max-w-md mx-auto">
          <p>
            Track anything that matters — pain, mood, sleep, or something uniquely yours.
          </p>
          <p className="flex items-center justify-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            AI helps set up smart labels tailored to what you're tracking.
          </p>
          <p className="text-sm">
            Your data stays private and secure. 💙
          </p>
        </div>

        {/* Preset trackers */}
        <div className="space-y-4">
          <p className="text-sm font-medium text-foreground">
            What would you like to track?
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TRACKER_PRESETS.map((preset) => (
              <Card
                key={preset.id}
                className={`
                  cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md
                  ${creatingPreset === preset.id ? 'opacity-50 pointer-events-none' : ''}
                `}
                onClick={() => handlePresetClick(preset.id)}
              >
                <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                  {creatingPreset === preset.id ? (
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  ) : (
                    <Activity 
                      className="w-6 h-6" 
                      style={{ color: preset.color }} 
                    />
                  )}
                  <span className="text-sm font-medium leading-tight">
                    {preset.name}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-sm text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Custom tracker input */}
        <form onSubmit={handleCustomSubmit} className="flex gap-2 max-w-sm mx-auto">
          <Input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Track something else..."
            disabled={creating}
            className="flex-1"
          />
          <Button type="submit" disabled={creating || !customName.trim()}>
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Start'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
