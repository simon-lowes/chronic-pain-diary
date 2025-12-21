import { db, auth } from '@/runtime/appRuntime'
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
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

import { PainEntry } from '@/types/pain-entry'
import { PainEntryForm } from '@/components/PainEntryForm'
import { PainEntryCard } from '@/components/PainEntryCard'
import { EmptyState } from '@/components/EmptyState'
import { AuthForm } from '@/components/AuthForm'
import { filterEntriesByDateRange, filterEntriesByLocation } from '@/lib/pain-utils'
import { BODY_LOCATIONS } from '@/types/pain-entry'
import type { AuthUser } from '@/ports/AuthPort'

function App() {
  const [user, setUser] = useState<AuthUser | null>(auth.getUser())
  const [authLoading, setAuthLoading] = useState(true)
  const [entries, setEntries] = useState<PainEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [emailConfirmed, setEmailConfirmed] = useState(false)

  // Listen for auth state changes
  useEffect(() => {
    // Check initial session
    auth.getSession().then((session) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    // Subscribe to auth changes
    const { unsubscribe } = auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      
      // Handle email confirmation - user just verified their email
      if (event === 'SIGNED_IN' && session?.user) {
        // Check if this is from an email confirmation (URL has access_token hash)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        if (hashParams.get('access_token') || hashParams.get('type') === 'signup') {
          setEmailConfirmed(true)
          toast.success('Email confirmed! You are now signed in.')
          // Clean up the URL
          window.history.replaceState(null, '', window.location.pathname)
        }
      }
      
      if (event === 'SIGNED_OUT') {
        setEntries([])
        setEmailConfirmed(false)
      }
    })

    return () => unsubscribe()
  }, [])

  // Load entries when user is authenticated
  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const loadEntries = async () => {
      const { data, error } = await db.select<PainEntry>('pain_entries', {
        orderBy: { column: 'timestamp', ascending: false },
      })

      if (error) {
        console.error(error)
        toast.error('Could not load entries')
        setLoading(false)
        return
      }

      setEntries(data ?? [])
      setLoading(false)
    }

    loadEntries()
  }, [user])
  const [showForm, setShowForm] = useState(false)
  const [dateFilter, setDateFilter] = useState<string | null>(null)
  const [locationFilter, setLocationFilter] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const handleAddEntry = async (data: {
    intensity: number
    locations: string[]
    notes: string
    triggers: string[]
  }) => {
    if (!user) {
      toast.error('You must be signed in to add entries')
      return
    }

    const newEntry: PainEntry = {
      id: `${Date.now()}-${Math.random()}`,
      user_id: user.id,
      timestamp: Date.now(),
      ...data,
    }

    const { error } = await db.insert<PainEntry>('pain_entries', newEntry)

    if (error) {
      console.error(error)
      toast.error('Could not save entry')
      return
    }

    setEntries(current => [newEntry, ...current])
    setShowForm(false)
    toast.success('Pain entry saved')
  }

  const handleDeleteEntry = async (id: string) => {
    const { error } = await db.delete('pain_entries', { id })

    if (error) {
      console.error(error)
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
    const { error } = await auth.signOut()
    if (error) {
      toast.error('Could not sign out')
    } else {
      toast.success('Signed out')
    }
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
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
        Loading your diary…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      
      {/* Email confirmed banner */}
      {emailConfirmed && (
        <div className="bg-green-500/10 border-b border-green-500/20 px-4 py-3 text-center">
          <p className="text-sm text-green-700 dark:text-green-400">
            ✅ Email confirmed! Welcome to Chronic Pain Diary.
          </p>
        </div>
      )}
      
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground tracking-tight">
              Chronic Pain Diary
            </h1>
            <p className="text-muted-foreground mt-1">
              Track and understand your pain patterns
            </p>
          </div>
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
                onSubmit={handleAddEntry}
                onCancel={() => setShowForm(false)}
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
                Log Pain Entry
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
                <EmptyState />
              ) : (
                <div className="space-y-4">
                  {filteredEntries.map(entry => (
                    <PainEntryCard
                      key={entry.id}
                      entry={entry}
                      onDelete={handleDeleteEntry}
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
                      onDelete={handleDeleteEntry}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {entryCount === 0 && !showForm && <EmptyState />}
      </main>

      <footer className="border-t mt-16">
        <div className="container max-w-4xl mx-auto px-6 py-6">
          <p className="text-sm text-muted-foreground text-center">
            Your pain diary data is stored securely and privately.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
