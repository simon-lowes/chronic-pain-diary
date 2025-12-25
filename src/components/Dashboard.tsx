/**
 * Dashboard Component
 * 
 * Home screen for returning users showing all their trackers.
 * Displays tracker cards with entry counts and quick access.
 */

import { useEffect, useState } from 'react';
import { Activity, Plus, Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Tracker, TrackerPresetId } from '@/types/tracker';
import { TRACKER_PRESETS } from '@/types/tracker';
import type { GeneratedTrackerConfig } from '@/types/generated-config';
import type { PainEntry } from '@/types/pain-entry';
import { db, tracker as trackerService } from '@/runtime/appRuntime';
import { generateTrackerConfig, getGenericConfig } from '@/services/configGenerationService';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface TrackerStats {
  entryCount: number;
  lastEntryDate: number | null;
}

interface DashboardProps {
  trackers: Tracker[];
  onTrackerSelect: (tracker: Tracker) => void;
  onTrackerCreated: (tracker: Tracker) => void;
}

export function Dashboard({ 
  trackers, 
  onTrackerSelect,
  onTrackerCreated,
}: Readonly<DashboardProps>) {
  const [stats, setStats] = useState<Record<string, TrackerStats>>({});
  const [loadingStats, setLoadingStats] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [creating, setCreating] = useState(false);
  const [creatingPreset, setCreatingPreset] = useState<TrackerPresetId | null>(null);

  // Load entry counts for each tracker
  useEffect(() => {
    async function loadStats() {
      setLoadingStats(true);
      const newStats: Record<string, TrackerStats> = {};

      // Fetch stats for all trackers in parallel
      await Promise.all(
        trackers.map(async (tracker) => {
          try {
            const { data } = await db.select<PainEntry>('pain_entries', {
              where: { tracker_id: tracker.id },
              orderBy: { column: 'timestamp', ascending: false },
            });

            newStats[tracker.id] = {
              entryCount: data?.length ?? 0,
              lastEntryDate: data?.[0]?.timestamp ?? null,
            };
          } catch {
            newStats[tracker.id] = { entryCount: 0, lastEntryDate: null };
          }
        })
      );

      setStats(newStats);
      setLoadingStats(false);
    }

    if (trackers.length > 0) {
      loadStats();
    } else {
      setLoadingStats(false);
    }
  }, [trackers]);

  function formatLastEntry(timestamp: number | null): string {
    if (!timestamp) return 'No entries yet';
    try {
      return `Last: ${formatDistanceToNow(new Date(timestamp), { addSuffix: true })}`;
    } catch {
      return 'No entries yet';
    }
  }

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
        is_default: false,
      });

      if (result.error) {
        toast.error('Failed to create tracker');
        return;
      }

      if (result.data) {
        toast.success(`${preset.name} tracker created!`);
        setCreateDialogOpen(false);
        onTrackerCreated(result.data);
      }
    } catch {
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
      let generatedConfig: GeneratedTrackerConfig | null = null;
      try {
        const result = await generateTrackerConfig(name);
        if (result.success && result.config) {
          generatedConfig = result.config;
        }
      } catch {
        // Fall back to generic
      }
      
      if (!generatedConfig) {
        generatedConfig = getGenericConfig(name);
      }

      const result = await trackerService.createTracker({
        name,
        type: 'custom',
        icon: 'activity',
        color: '#6366f1',
        is_default: false,
        generated_config: generatedConfig,
      });

      if (result.error) {
        toast.error('Failed to create tracker');
        return;
      }

      if (result.data) {
        toast.success(`${name} tracker created!`);
        setCreateDialogOpen(false);
        setCustomName('');
        onTrackerCreated(result.data);
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center sm:text-left">
          <h2 className="text-2xl font-semibold text-foreground">
            Your Trackers
          </h2>
          <p className="text-muted-foreground mt-1">
            Select a tracker to view or add entries
          </p>
        </div>

        {/* Tracker cards grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {trackers.map((tracker) => {
            const trackerStats = stats[tracker.id];
            const isLoading = loadingStats && !trackerStats;

            return (
              <Card
                key={tracker.id}
                className="cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md group"
                onClick={() => onTrackerSelect(tracker)}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Icon and name */}
                  <div className="flex items-start gap-3">
                    <div 
                      className="p-2 rounded-lg transition-colors"
                      style={{ backgroundColor: `${tracker.color}15` }}
                    >
                      <Activity 
                        className="w-5 h-5" 
                        style={{ color: tracker.color }} 
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {tracker.name}
                      </h3>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="text-sm text-muted-foreground space-y-1">
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Loading...</span>
                      </div>
                    ) : (
                      <>
                        <p>
                          {trackerStats?.entryCount ?? 0} {(trackerStats?.entryCount ?? 0) === 1 ? 'entry' : 'entries'}
                        </p>
                        <p className="text-xs">
                          {formatLastEntry(trackerStats?.lastEntryDate ?? null)}
                        </p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Add new tracker card */}
          <Card
            className="cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md border-dashed"
            onClick={() => setCreateDialogOpen(true)}
          >
            <CardContent className="p-4 flex flex-col items-center justify-center h-full min-h-[120px] text-muted-foreground hover:text-primary transition-colors">
              <Plus className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">New Tracker</span>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Tracker Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Tracker</DialogTitle>
            <DialogDescription>
              Track anything that matters to you.
            </DialogDescription>
          </DialogHeader>

          {/* Preset options */}
          <div className="grid grid-cols-2 gap-2">
            {TRACKER_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                variant="outline"
                className="h-auto py-3 flex flex-col items-center gap-1"
                disabled={creatingPreset !== null}
                onClick={() => handlePresetClick(preset.id)}
              >
                {creatingPreset === preset.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Activity className="w-5 h-5" style={{ color: preset.color }} />
                )}
                <span className="text-xs">{preset.name}</span>
              </Button>
            ))}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or create custom</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Custom tracker input */}
          <form onSubmit={handleCustomSubmit} className="flex gap-2">
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g., Migraines, Diet, Gratitude..."
              disabled={creating}
              className="flex-1"
            />
            <Button type="submit" disabled={creating || !customName.trim()}>
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
            </Button>
          </form>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
