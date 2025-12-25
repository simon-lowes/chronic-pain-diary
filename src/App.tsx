import { db, auth, tracker as trackerService } from '@/runtime/appRuntime'
import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, List, Calendar, SignOut } from '@phosphor-icons/react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

import { PainEntry, BODY_LOCATIONS } from '@/types/pain-entry'
import type { Tracker, TrackerPresetId } from '@/types/tracker'
import { PainEntryForm } from '@/components/PainEntryForm'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PainEntryCard } from '@/components/PainEntryCard'
import { EmptyState } from '@/components/EmptyState'
import { AuthForm } from '@/components/AuthForm'
import { TrackerSelector } from '@/components/TrackerSelector'
import { filterEntriesByDateRange, filterEntriesByLocation } from '@/lib/pain-utils'
import { getTrackerConfig } from '@/types/tracker-config'
import type { AuthUser } from '@/ports/AuthPort'

/**
 * Validates session against Supabase server before trusting any state.
 * This catches: deleted users, expired tokens, revoked sessions, etc.
 */
async function validateAndInitAuth(
  setUser: (user: AuthUser | null) => void,
  setAuthLoading: (loading: boolean) => void
): Promise<void> {
  try {
    console.log('[Auth] Starting server-side session validation...')
    
    // Prevent hanging forever if the auth endpoint is slow/unreachable
    const session = await Promise.race([
      auth.getSession(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ])
    
    if (session === null) {
      console.warn('[Auth] Session validation timed out or returned null')
      setUser(null)
      return
    }
    
    console.log('[Auth] Session validated successfully:', session.user.email)
    setUser(session.user)
  } catch (error) {
    console.error('[Auth] Session validation failed:', error)
    // Force sign out to clear any stale tokens from localStorage
    try {
      await auth.signOut()
    } catch (signOutError) {
      console.warn('[Auth] SignOut during cleanup failed:', signOutError)
    }
    setUser(null)
  } finally {
    setAuthLoading(false)
  }
}

function App() {
  // CRITICAL: Start with null user, not cached value
  // Only trust user state AFTER server validation completes
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [entries, setEntries] = useState<PainEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [emailConfirmed, setEmailConfirmed] = useState(false)
  const [passwordRecoveryOpen, setPasswordRecoveryOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [currentTracker, setCurrentTracker] = useState<Tracker | null>(null)
  const [aboutOpen, setAboutOpen] = useState(false)

  // Listen for auth state changes
  useEffect(() => {
    void validateAndInitAuth(setUser, setAuthLoading)

    // Subscribe to auth changes
    const { unsubscribe } = auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      
      // Handle email confirmation - user just verified their email
      if (event === 'SIGNED_IN' && session?.user) {
        // Check if this is from an email confirmation (URL has access_token hash)
        const hashParams = new URLSearchParams(globalThis.location.hash.substring(1))
        if (hashParams.get('access_token') || hashParams.get('type') === 'signup') {
          setEmailConfirmed(true)
          toast.success('Email confirmed! You are now signed in.')
          // Clean up the URL
          globalThis.history.replaceState(null, '', globalThis.location.pathname)
        }
      }
      
      if (event === 'PASSWORD_RECOVERY') {
        // Show reset password dialog when Supabase triggers recovery event
        setPasswordRecoveryOpen(true)
      } else if (event === 'SIGNED_OUT') {
        setEntries([])
        setEmailConfirmed(false)
      }
    })

    return () => unsubscribe()
  }, [])

  // Load entries when user is authenticated and tracker is selected
  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    // Ensure user has a default tracker
    const ensureTracker = async () => {
      if (!currentTracker) {
        const result = await trackerService.ensureDefaultTracker()
        if (result.data) {
          setCurrentTracker(result.data)
        }
      }
    }
    ensureTracker()
  }, [user, currentTracker])

  // Load entries when tracker changes
  useEffect(() => {
    if (!user || !currentTracker) {
      return
    }

    const loadEntries = async () => {
      setLoading(true)
      const { data, error } = await db.select<PainEntry>('pain_entries', {
        where: { tracker_id: currentTracker.id },
        orderBy: { column: 'timestamp', ascending: false },
      })

      if (error) {
        console.error(error)
        
        // Check for auth-related errors (deleted user, invalid token, etc.)
        const errorMsg = error.message?.toLowerCase() ?? ''
        if (
          errorMsg.includes('jwt') ||
          errorMsg.includes('token') ||
          errorMsg.includes('unauthorized') ||
          errorMsg.includes('auth') ||
          errorMsg.includes('permission') ||
          errorMsg.includes('row-level security')
        ) {
          toast.error('Session expired. Please sign in again.')
          await auth.signOut()
          setUser(null)
          return
        }
        
        toast.error('Could not load entries')
        setLoading(false)
        return
      }

      setEntries(data ?? [])
      setLoading(false)
    }

    loadEntries()
  }, [user, currentTracker])
  const [showForm, setShowForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState<PainEntry | null>(null)
  const [dateFilter, setDateFilter] = useState<string | null>(null)
  const [locationFilter, setLocationFilter] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  // Helper to check if an error is auth-related
  const isAuthError = (error: Error | null): boolean => {
    if (!error?.message) return false
    const msg = error.message.toLowerCase()
    return (
      msg.includes('jwt') ||
      msg.includes('token') ||
      msg.includes('unauthorized') ||
      msg.includes('auth') ||
      msg.includes('permission') ||
      msg.includes('row-level security')
    )
  }

  // Handle auth errors by signing out
  const handleAuthError = async () => {
    toast.error('Session expired. Please sign in again.')
    await auth.signOut()
    setUser(null)
  }

  const handleAddEntry = async (data: {
    intensity: number
    locations: string[]
    notes: string
    triggers: string[]
    hashtags: string[]
  }) => {
    if (!user) {
      toast.error('You must be signed in to add entries')
      return
    }

    if (!currentTracker) {
      toast.error('Please select a tracker first')
      return
    }

    const newEntry: PainEntry = {
      id: `${Date.now()}-${Math.random()}`,
      user_id: user.id,
      tracker_id: currentTracker.id,
      timestamp: Date.now(),
      ...data,
    }

    const { error } = await db.insert<PainEntry>('pain_entries', newEntry)

    if (error) {
      console.error(error)
      if (isAuthError(error)) {
        await handleAuthError()
        return
      }
      toast.error('Could not save entry')
      return
    }

    setEntries(current => [newEntry, ...current])
    setShowForm(false)
    toast.success('Entry saved')
  }

  const handleEditEntry = (entry: PainEntry) => {
    setEditingEntry(entry)
    setShowForm(true)
  }

  const handleUpdateEntry = async (data: {
    intensity: number
    locations: string[]
    notes: string
    triggers: string[]
    hashtags: string[]
  }) => {
    if (!editingEntry) return

    const updatedEntry: PainEntry = {
      ...editingEntry,
      ...data,
    }

    const { error } = await db.update<PainEntry>('pain_entries', {
      id: editingEntry.id,
      ...data,
    })

    if (error) {
      console.error(error)
      if (isAuthError(error)) {
        await handleAuthError()
        return
      }
      toast.error('Could not update entry')
      return
    }

    setEntries(current =>
      current.map(entry =>
        entry.id === editingEntry.id ? updatedEntry : entry
      )
    )
    setShowForm(false)
    setEditingEntry(null)
    toast.success('Entry updated')
  }

  const handleDeleteEntry = async (id: string) => {
    const { error } = await db.delete('pain_entries', { id })

    if (error) {
      console.error(error)
      if (isAuthError(error)) {
        await handleAuthError()
        return
      }
      toast.error('Could not delete entry')
      return
    }

    setEntries(current => current.filter(entry => entry.id !== id))
    toast.success('Entry deleted')
  }

  const filteredEntries = useMemo(() => {
    if (!entries) return []

    let filtered = entries

    if (dateFilter) {
      filtered = filterEntriesByDateRange(filtered, parseInt(dateFilter, 10))
    }

    if (locationFilter) {
      filtered = filterEntriesByLocation(filtered, locationFilter)
    }

    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase()

      filtered = filtered.filter(entry => {
        const text = [
          entry.notes,
          entry.triggers.join(' '),
          entry.locations.join(' '),
          (entry.hashtags ?? []).map(tag => `#${tag}`).join(' '),
          String(entry.intensity),
        ]
          .join(' ')
          .toLowerCase()

        return text.includes(query)
      })
    }

    return filtered
  }, [entries, dateFilter, locationFilter, searchTerm])

  const entryCount = entries?.length ?? 0

  const handleSignOut = async () => {
    console.log('[App] Sign out clicked');
    try {
      const { error } = await auth.signOut()
      console.log('[App] Sign out result:', error?.message);
      if (error) {
        toast.error('Could not sign out')
      } else {
        toast.success('Signed out')
      }
    } catch (err) {
      console.error('[App] Sign out exception:', err);
      toast.error('Sign out failed');
    }
  }

  const handlePasswordUpdate = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setUpdatingPassword(true)
    const { error } = await auth.updatePassword({ password: newPassword })
    setUpdatingPassword(false)
    if (error) {
      toast.error(error.message || 'Could not update password')
      return
    }
    toast.success('Password updated successfully')
    setPasswordRecoveryOpen(false)
    setNewPassword('')
    setConfirmPassword('')
  }

  // Show loading while validating auth with server
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-muted-foreground gap-2">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span>Validating session…</span>
      </div>
    )
  }

  // Show auth form if not signed in
  if (!user) {
    return (
      <>
        <Toaster />
        <AuthForm />
      </>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading your data…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      
      {/* About Dialog */}
      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Baseline</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p className="text-base text-foreground">
              Know your baseline, spot the changes.
            </p>
            <p>
              Baseline helps you track anything that matters to your health and wellbeing. 
              Whether it's chronic pain, mood, sleep, or custom trackers powered by AI — 
              understanding your patterns is the first step to feeling better.
            </p>
            <div className="space-y-2">
              <h3 className="font-medium text-foreground">Features</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>Track multiple health conditions with custom trackers</li>
                <li>AI-powered context generation for personalized tracking</li>
                <li>Visual insights with calendar and list views</li>
                <li>Tag entries with locations, triggers, and hashtags</li>
                <li>Private and secure — your data stays yours</li>
              </ul>
            </div>
            <p className="text-xs pt-2 border-t">
              Made with care for people managing chronic conditions. 💙
            </p>
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={passwordRecoveryOpen} onOpenChange={setPasswordRecoveryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setPasswordRecoveryOpen(false)}>Cancel</Button>
              <Button onClick={handlePasswordUpdate} disabled={updatingPassword}>
                {updatingPassword ? 'Updating…' : 'Update password'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Email confirmed banner */}
      {emailConfirmed && (
        <div className="bg-green-500/10 border-b border-green-500/20 px-4 py-3 text-center">
          <p className="text-sm text-green-700 dark:text-green-400">
            ✅ Email confirmed! Welcome to Baseline.
          </p>
        </div>
      )}
      
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-4xl mx-auto px-6 py-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setAboutOpen(true)}
              className="text-left hover:opacity-80 transition-opacity group"
            >
              <div className="inline-flex items-start">
                <h1 className="text-3xl font-semibold text-foreground tracking-tight">
                  Baseline
                </h1>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span 
                        className="-mt-0.5 ml-1 w-5 h-5 rounded-full border border-primary/40 bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold group-hover:bg-primary/20 group-hover:border-primary/60 transition-all cursor-pointer"
                        aria-label="About Baseline"
                      >
                        i
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[220px] text-xs">
                      <p>Track health patterns with AI-powered insights. Click for more info.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-muted-foreground mt-1">
                Know your baseline, spot the changes
              </p>
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="gap-2"
            >
              <SignOut size={18} />
              Sign Out
            </Button>
          </div>
          
          {/* Tracker Selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Tracking:</span>
            <TrackerSelector
              currentTracker={currentTracker}
              onTrackerChange={setCurrentTracker}
            />
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-6 py-8 space-y-8">
        <AnimatePresence mode="wait">
          {showForm ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <PainEntryForm
                tracker={currentTracker}
                editEntry={editingEntry}
                onSubmit={editingEntry ? handleUpdateEntry : handleAddEntry}
                onCancel={() => {
                  setShowForm(false)
                  setEditingEntry(null)
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="button"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                onClick={() => setShowForm(true)}
                size="lg"
                className="w-full sm:w-auto gap-2 bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg"
              >
                <Plus size={20} weight="bold" />
                {getTrackerConfig(currentTracker?.preset_id as TrackerPresetId | null, currentTracker?.generated_config).addButtonLabel}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {entryCount > 0 && (
          <Tabs defaultValue="all" className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <TabsList className="bg-muted">
                <TabsTrigger value="all" className="gap-2">
                  <List size={18} />
                  All Entries
                </TabsTrigger>
                <TabsTrigger value="filter" className="gap-2">
                  <Calendar size={18} />
                  Filter
                </TabsTrigger>
              </TabsList>

              {/* Search box */}
              <div className="w-full sm:max-w-xs">
                <Input
                  placeholder="Search notes, triggers, locations…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <TabsContent value="all" className="space-y-4 mt-6">
              {filteredEntries.length === 0 ? (
                <EmptyState tracker={currentTracker} />
              ) : (
                <div className="space-y-4">
                  {filteredEntries.map(entry => (
                    <PainEntryCard
                      key={entry.id}
                      entry={entry}
                      tracker={currentTracker}
                      onDelete={handleDeleteEntry}
                      onEdit={handleEditEntry}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="filter" className="space-y-6 mt-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Time Period</label>
                  <Select
                    value={dateFilter || 'all'}
                    onValueChange={value =>
                      setDateFilter(value === 'all' ? null : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All time</SelectItem>
                      <SelectItem value="7">Last 7 days</SelectItem>
                      <SelectItem value="14">Last 14 days</SelectItem>
                      <SelectItem value="30">Last 30 days</SelectItem>
                      <SelectItem value="90">Last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Location</label>
                  <Select
                    value={locationFilter || 'all'}
                    onValueChange={value =>
                      setLocationFilter(value === 'all' ? null : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All locations</SelectItem>
                      {BODY_LOCATIONS.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filteredEntries.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    No entries match your filters. Try adjusting your criteria.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {filteredEntries.length}{' '}
                    {filteredEntries.length === 1 ? 'entry' : 'entries'}
                  </p>
                  {filteredEntries.map(entry => (
                    <PainEntryCard
                      key={entry.id}
                      entry={entry}
                      tracker={currentTracker}
                      onDelete={handleDeleteEntry}
                      onEdit={handleEditEntry}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {entryCount === 0 && !showForm && <EmptyState tracker={currentTracker} />}
      </main>

      <footer className="border-t mt-16">
        <div className="container max-w-4xl mx-auto px-6 py-6">
          <p className="text-sm text-muted-foreground text-center">
            Your data is stored securely and privately.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
