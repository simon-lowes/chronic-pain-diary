/**
 * TrackerSelector Component
 * 
 * Allows users to switch between their trackers or create new ones.
 * Shows the current tracker with a dropdown to switch.
 * Includes AI-powered context generation for custom trackers.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Plus, ChevronDown, Check, Sparkles, Loader2, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { tracker as trackerService } from '@/runtime/appRuntime';
import type { Tracker } from '@/types/tracker';
import { TRACKER_PRESETS } from '@/types/tracker';
import { generateTrackerConfig, getGenericConfig } from '@/services/configGenerationService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TrackerSelectorProps {
  currentTracker: Tracker | null;
  onTrackerChange: (tracker: Tracker) => void;
  className?: string;
}

type GenerationStep = 'input' | 'generating' | 'needs-description' | 'error';

/**
 * Get dialog title based on generation step
 */
function getDialogTitle(step: GenerationStep): string {
  if (step === 'needs-description') {
    return 'Describe Your Tracker';
  }
  if (step === 'error') {
    return 'Generation Issue';
  }
  return 'Create New Tracker';
}

/**
 * Get dialog description based on generation step
 */
function getDialogDescription(step: GenerationStep, trackerName: string): string {
  if (step === 'needs-description') {
    return `We couldn't find a definition for "${trackerName}". For the best experience, please describe what you want to track.`;
  }
  if (step === 'error') {
    return 'There was an issue generating the configuration. You can try again, provide a description, or use a generic setup.';
  }
  return "Track anything that matters to you. We'll use AI to set up contextual labels and suggestions.";
}

interface DialogFooterButtonsProps {
  generationStep: GenerationStep;
  creating: boolean;
  userDescription: string;
  newTrackerName: string;
  handleCreateWithDescription: () => void;
  handleCreateTracker: () => void;
  handleCreateGeneric: () => void;
  resetCreateDialog: () => void;
}

/**
 * Render the appropriate dialog footer buttons based on generation step
 */
function DialogFooterButtons({
  generationStep,
  creating,
  userDescription,
  newTrackerName,
  handleCreateWithDescription,
  handleCreateTracker,
  handleCreateGeneric,
  resetCreateDialog,
}: Readonly<DialogFooterButtonsProps>): React.ReactNode {
  if (generationStep === 'generating') {
    return null;
  }

  if (generationStep === 'needs-description') {
    return (
      <>
        <Button 
          variant="outline" 
          onClick={handleCreateGeneric}
          disabled={creating}
        >
          Use Generic Setup
        </Button>
        <Button 
          onClick={handleCreateWithDescription} 
          disabled={creating || !userDescription.trim()}
        >
          {creating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate with AI
            </>
          )}
        </Button>
      </>
    );
  }

  if (generationStep === 'error') {
    const handleRetry = userDescription.trim() ? handleCreateWithDescription : handleCreateTracker;
    return (
      <>
        <Button 
          variant="outline" 
          onClick={handleCreateGeneric}
          disabled={creating}
        >
          Use Generic Setup
        </Button>
        <Button 
          onClick={handleRetry} 
          disabled={creating}
        >
          {creating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Trying Again...
            </>
          ) : (
            'Try Again'
          )}
        </Button>
      </>
    );
  }

  // Default: 'input' step
  return (
    <>
      <Button variant="outline" onClick={resetCreateDialog}>
        Cancel
      </Button>
      <Button onClick={handleCreateTracker} disabled={creating || !newTrackerName.trim()}>
        {creating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Create with AI
          </>
        )}
      </Button>
    </>
  );
}

interface DialogContentAreaProps {
  generationStep: GenerationStep;
  generationStatus: string;
  generationError: string;
  newTrackerName: string;
  userDescription: string;
  setUserDescription: (value: string) => void;
  setNewTrackerName: (value: string) => void;
  creating: boolean;
  handleCreateTracker: () => void;
  trackers: Tracker[];
  setCreating: (value: boolean) => void;
  setTrackers: React.Dispatch<React.SetStateAction<Tracker[]>>;
  onTrackerChange: (tracker: Tracker) => void;
  resetCreateDialog: () => void;
}

/**
 * Render the dialog content area based on generation step
 */
function DialogContentArea({
  generationStep,
  generationStatus,
  generationError,
  newTrackerName,
  userDescription,
  setUserDescription,
  setNewTrackerName,
  creating,
  handleCreateTracker,
  trackers,
  setCreating,
  setTrackers,
  onTrackerChange,
  resetCreateDialog,
}: Readonly<DialogContentAreaProps>): React.ReactNode {
  if (generationStep === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-sm text-muted-foreground">{generationStatus}</p>
        </div>
      </div>
    );
  }

  if (generationStep === 'needs-description') {
    return (
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="tracker-description">
            What is "{newTrackerName}"?
          </Label>
          <Textarea
            id="tracker-description"
            placeholder="e.g., Tracking my blood pressure readings to monitor cardiovascular health..."
            value={userDescription}
            onChange={(e) => setUserDescription(e.target.value)}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            This helps us generate relevant categories, triggers, and suggestions for your tracker.
          </p>
        </div>
      </div>
    );
  }

  if (generationStep === 'error') {
    return (
      <div className="grid gap-4 py-4">
        <div className="p-3 bg-destructive/10 rounded-md border border-destructive/20">
          <p className="text-sm text-destructive">{generationError}</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tracker-description-error">
            Provide a description (recommended)
          </Label>
          <Textarea
            id="tracker-description-error"
            placeholder="Describe what you want to track..."
            value={userDescription}
            onChange={(e) => setUserDescription(e.target.value)}
            rows={3}
          />
        </div>
      </div>
    );
  }

  // Default: 'input' step
  return (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="tracker-name">Tracker Name</Label>
        <Input
          id="tracker-name"
          placeholder="e.g., Hypertension, Allergies, Gratitude"
          value={newTrackerName}
          onChange={(e) => setNewTrackerName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !creating) {
              handleCreateTracker();
            }
          }}
        />
      </div>
      
      {/* Quick preset suggestions */}
      <div className="grid gap-2">
        <Label className="text-xs text-muted-foreground">Or use a preset:</Label>
        <div className="flex flex-wrap gap-2">
          {TRACKER_PRESETS.filter(p => 
            !trackers.some(t => t.preset_id === p.id)
          ).slice(0, 4).map((preset) => (
            <Button
              key={preset.id}
              variant="outline"
              size="sm"
              onClick={async () => {
                setCreating(true);
                const result = await trackerService.createTracker({
                  name: preset.name,
                  type: 'preset',
                  preset_id: preset.id,
                  icon: preset.icon,
                  color: preset.color,
                });
                if (result.data) {
                  toast.success(`Created "${preset.name}" tracker`);
                  setTrackers(prev => [...prev, result.data!]);
                  onTrackerChange(result.data);
                  resetCreateDialog();
                }
                setCreating(false);
              }}
              disabled={creating}
              style={{ borderColor: preset.color }}
            >
              {preset.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TrackerSelector({ 
  currentTracker, 
  onTrackerChange, 
  className 
}: Readonly<TrackerSelectorProps>) {
  const isMobile = useIsMobile();
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTrackerName, setNewTrackerName] = useState('');
  const [creating, setCreating] = useState(false);
  
  // AI generation states
  const [generationStep, setGenerationStep] = useState<GenerationStep>('input');
  const [generationStatus, setGenerationStatus] = useState('');
  const [userDescription, setUserDescription] = useState('');
  const [generationError, setGenerationError] = useState('');
  
  // Delete tracker states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDrawerOpen, setDeleteDrawerOpen] = useState(false);
  const [trackerToDelete, setTrackerToDelete] = useState<Tracker | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load trackers on mount
  const loadTrackers = useCallback(async () => {
    setLoading(true);
    try {
      console.log('[TrackerSelector] Loading trackers...');
      // Add timeout to prevent infinite loading
      const result = await Promise.race([
        trackerService.getTrackers(),
        new Promise<{ data: null; error: Error }>((resolve) => 
          setTimeout(() => resolve({ data: null, error: new Error('Timeout') }), 5000)
        ),
      ]);
      
      console.log('[TrackerSelector] Result:', result);
      
      if (result.data) {
        console.log('[TrackerSelector] Loaded', result.data.length, 'trackers');
        setTrackers(result.data);
        
        // If no current tracker selected, select the default
        if (!currentTracker && result.data.length > 0) {
          const defaultTracker = result.data.find(t => t.is_default) || result.data[0];
          onTrackerChange(defaultTracker);
        }
      } else if (result.error) {
        console.error('[TrackerSelector] Error loading trackers:', result.error);
      }
    } catch (err) {
      console.error('Failed to load trackers:', err);
    }
    setLoading(false);
  }, [currentTracker, onTrackerChange]);

  useEffect(() => {
    loadTrackers();
  }, [loadTrackers]);

  async function handleCreateTracker() {
    if (!newTrackerName.trim()) {
      toast.error('Please enter a tracker name');
      return;
    }

    const trackerName = newTrackerName.trim();
    setCreating(true);
    setGenerationStep('generating');
    setGenerationStatus('Looking up definition...');

    try {
      // Step 1: Try to generate config
      const genResult = await generateTrackerConfig(trackerName, userDescription || undefined);
      
      if (genResult.needsDescription) {
        // Word not found - ask for description
        setGenerationStep('needs-description');
        setCreating(false);
        return;
      }
      
      if (!genResult.success) {
        // Generation failed - show error with option to continue
        setGenerationStep('error');
        setGenerationError(genResult.error || 'Failed to generate configuration');
        setCreating(false);
        return;
      }
      
      setGenerationStatus('Creating tracker...');
      
      // Step 2: Create tracker with generated config
      const result = await trackerService.createTracker({
        name: trackerName,
        type: 'custom',
        generated_config: genResult.config,
        user_description: userDescription || undefined,
      });

      if (result.error) {
        toast.error(`Failed to create tracker: ${result.error.message}`);
      } else if (result.data) {
        toast.success(`Created "${result.data.name}" tracker with AI-powered context`);
        setTrackers(prev => [...prev, result.data!]);
        onTrackerChange(result.data);
        resetCreateDialog();
        
        // Generate image asynchronously (don't block UI)
        try {
          const { generateTrackerImage, updateTrackerImage } = await import('@/services/imageGenerationService');
          const imageResult = await generateTrackerImage(trackerName, result.data.id);
          if (imageResult.success && imageResult.imageUrl && imageResult.modelName) {
            await updateTrackerImage(result.data.id, imageResult.imageUrl, imageResult.modelName);
            console.log(`Image generated for tracker: ${trackerName}`);
          }
        } catch (error) {
          console.warn('Failed to generate tracker image:', error);
          // Don't show error to user - image generation is non-critical
        }
      }
    } catch (error) {
      console.error('Create tracker error:', error);
      setGenerationStep('error');
      setGenerationError(error instanceof Error ? error.message : 'Unknown error');
    }
    
    setCreating(false);
  }

  async function handleCreateWithDescription() {
    if (!userDescription.trim()) {
      toast.error('Please enter a description');
      return;
    }
    
    setCreating(true);
    setGenerationStep('generating');
    setGenerationStatus('Generating contextual configuration...');
    
    try {
      const genResult = await generateTrackerConfig(newTrackerName.trim(), userDescription.trim());
      
      if (!genResult.success) {
        setGenerationStep('error');
        setGenerationError(genResult.error || 'Failed to generate configuration');
        setCreating(false);
        return;
      }
      
      setGenerationStatus('Creating tracker...');
      
      const result = await trackerService.createTracker({
        name: newTrackerName.trim(),
        type: 'custom',
        generated_config: genResult.config,
        user_description: userDescription.trim(),
      });

      if (result.error) {
        toast.error(`Failed to create tracker: ${result.error.message}`);
      } else if (result.data) {
        toast.success(`Created "${result.data.name}" tracker with AI-powered context`);
        setTrackers(prev => [...prev, result.data!]);
        onTrackerChange(result.data);
        resetCreateDialog();
        
        // Generate image asynchronously (don't block UI)
        try {
          const { generateTrackerImage, updateTrackerImage } = await import('@/services/imageGenerationService');
          const imageResult = await generateTrackerImage(newTrackerName.trim(), result.data.id);
          if (imageResult.success && imageResult.imageUrl && imageResult.modelName) {
            await updateTrackerImage(result.data.id, imageResult.imageUrl, imageResult.modelName);
            console.log(`Image generated for tracker: ${newTrackerName.trim()}`);
          }
        } catch (error) {
          console.warn('Failed to generate tracker image:', error);
          // Don't show error to user - image generation is non-critical
        }
      }
    } catch (error) {
      console.error('Create tracker error:', error);
      setGenerationStep('error');
      setGenerationError(error instanceof Error ? error.message : 'Unknown error');
    }
    
    setCreating(false);
  }

  async function handleCreateGeneric() {
    setCreating(true);
    
    const trackerName = newTrackerName.trim();
    const genericConfig = getGenericConfig(trackerName);
    
    const result = await trackerService.createTracker({
      name: trackerName,
      type: 'custom',
      generated_config: genericConfig,
    });

    if (result.error) {
      toast.error(`Failed to create tracker: ${result.error.message}`);
    } else if (result.data) {
      toast.success(`Created "${result.data.name}" tracker`);
      setTrackers(prev => [...prev, result.data!]);
      onTrackerChange(result.data);
      resetCreateDialog();
      
      // Generate image asynchronously (don't block UI)
      try {
        const { generateTrackerImage, updateTrackerImage } = await import('@/services/imageGenerationService');
        const imageResult = await generateTrackerImage(trackerName, result.data.id);
        if (imageResult.success && imageResult.imageUrl && imageResult.modelName) {
          await updateTrackerImage(result.data.id, imageResult.imageUrl, imageResult.modelName);
          console.log(`Image generated for tracker: ${trackerName}`);
        }
      } catch (error) {
        console.warn('Failed to generate tracker image:', error);
        // Don't show error to user - image generation is non-critical
      }
    }
    
    setCreating(false);
  }

  function resetCreateDialog() {
    setCreateDialogOpen(false);
    setNewTrackerName('');
    setUserDescription('');
    setGenerationStep('input');
    setGenerationStatus('');
    setGenerationError('');
  }

  async function handleDeleteTracker() {
    if (!trackerToDelete) return;
    
    setDeleting(true);
    const result = await trackerService.deleteTracker(trackerToDelete.id);
    
    if (result.error) {
      toast.error(`Failed to delete: ${result.error.message}`);
    } else {
      toast.success(`Deleted "${trackerToDelete.name}" tracker`);
      setTrackers(prev => prev.filter(t => t.id !== trackerToDelete.id));
      
      // If we deleted the current tracker, switch to another one
      if (currentTracker?.id === trackerToDelete.id) {
        const remaining = trackers.filter(t => t.id !== trackerToDelete.id);
        if (remaining.length > 0) {
          const newDefault = remaining.find(t => t.is_default) || remaining[0];
          onTrackerChange(newDefault);
        }
      }
    }
    
    setDeleting(false);
    setDeleteDialogOpen(false);
    setTrackerToDelete(null);
  }

  function getTrackerIcon(tracker: Tracker) {
    // Map icon names to Lucide icons - for now just use Activity
    // In future phases, we'll have a proper icon picker
    return <Activity className="h-4 w-4" style={{ color: tracker.color }} />;
  }

  if (loading) {
    return (
      <div className={cn("h-9 w-40 animate-pulse rounded-md bg-muted", className)} />
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className={cn("justify-between gap-2 min-w-[160px]", className)}
          >
            {currentTracker ? (
              <>
                {getTrackerIcon(currentTracker)}
                <span className="truncate">{currentTracker.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Select tracker</span>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[240px]">
          {trackers.map((t) => (
            <DropdownMenuItem
              key={t.id}
              onClick={() => onTrackerChange(t)}
              className="flex items-center gap-2"
            >
              {getTrackerIcon(t)}
              <span className="flex-1 truncate">{t.name}</span>
              {currentTracker?.id === t.id && (
                <Check className="h-4 w-4" />
              )}
            </DropdownMenuItem>
          ))}
          
          {trackers.length > 0 && <DropdownMenuSeparator />}
          
          <DropdownMenuItem
            onClick={() => setCreateDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>New Tracker</span>
          </DropdownMenuItem>
          
          {/* Delete option - only show if more than one tracker */}
          {trackers.length > 1 && (
            isMobile ? (
              // On mobile, open a drawer instead of submenu
              <DropdownMenuItem
                onClick={() => setDeleteDrawerOpen(true)}
                className="flex items-center gap-2 text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Tracker</span>
              </DropdownMenuItem>
            ) : (
              // On desktop, use submenu with proper width
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center gap-2 text-destructive">
                  <Trash2 className="h-4 w-4" />
                  <span>Delete Tracker</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[200px]">
                  {trackers.map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      onClick={() => {
                        setTrackerToDelete(t);
                        setDeleteDialogOpen(true);
                      }}
                      className="flex items-center gap-2 text-destructive"
                    >
                      {getTrackerIcon(t)}
                      <span className="truncate">{t.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Tracker Drawer (mobile only) */}
      <Drawer open={deleteDrawerOpen} onOpenChange={setDeleteDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Delete Tracker</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-2">
            {trackers.map((t) => (
              <Button
                key={t.id}
                variant="ghost"
                onClick={() => {
                  setTrackerToDelete(t);
                  setDeleteDrawerOpen(false);
                  setDeleteDialogOpen(true);
                }}
                className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {getTrackerIcon(t)}
                <span>{t.name}</span>
              </Button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Create Tracker Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        if (!open) resetCreateDialog();
        else setCreateDialogOpen(true);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {getDialogTitle(generationStep)}
            </DialogTitle>
            <DialogDescription>
              {getDialogDescription(generationStep, newTrackerName)}
            </DialogDescription>
          </DialogHeader>
          
          <DialogContentArea
            generationStep={generationStep}
            generationStatus={generationStatus}
            generationError={generationError}
            newTrackerName={newTrackerName}
            userDescription={userDescription}
            setUserDescription={setUserDescription}
            setNewTrackerName={setNewTrackerName}
            creating={creating}
            handleCreateTracker={handleCreateTracker}
            trackers={trackers}
            setCreating={setCreating}
            setTrackers={setTrackers}
            onTrackerChange={onTrackerChange}
            resetCreateDialog={resetCreateDialog}
          />
          
          <DialogFooter>
            <DialogFooterButtons
              generationStep={generationStep}
              creating={creating}
              userDescription={userDescription}
              newTrackerName={newTrackerName}
              handleCreateWithDescription={handleCreateWithDescription}
              handleCreateTracker={handleCreateTracker}
              handleCreateGeneric={handleCreateGeneric}
              resetCreateDialog={resetCreateDialog}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Tracker Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        if (open) {
          return;
        }
        setDeleteDialogOpen(false);
        setTrackerToDelete(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Delete "{trackerToDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This action <strong>cannot be undone</strong>. This will permanently delete:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>The "{trackerToDelete?.name}" tracker</li>
                <li>All entries associated with this tracker</li>
                <li>All notes, tags, and history data</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTracker}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Yes, Delete Forever
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
