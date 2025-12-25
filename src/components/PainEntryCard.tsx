import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer'
import { Trash, NotePencil, Hash } from '@phosphor-icons/react'
import { PainEntry } from '@/types/pain-entry'
import type { Tracker } from '@/types/tracker'
import { formatDate } from '@/lib/pain-utils'
import { getTrackerConfig } from '@/types/tracker-config'
import { motion } from 'framer-motion'
import { useIsMobile } from '@/hooks/use-mobile'

interface PainEntryCardProps {
  entry: PainEntry
  tracker?: Tracker | null
  onDelete: (id: string) => void
  onEdit: (entry: PainEntry) => void
}

export function PainEntryCard({ entry, tracker, onDelete, onEdit }: Readonly<PainEntryCardProps>) {
  const [showDetails, setShowDetails] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const isMobile = useIsMobile()
  
  const config = getTrackerConfig(tracker?.preset_id, tracker?.generated_config)
  const intensityColor = config.getIntensityColor(entry.intensity)
  const intensityLabel = config.getIntensityLabel(entry.intensity)

  const handleDelete = () => {
    onDelete(entry.id)
    setShowDeleteConfirm(false)
    setShowDetails(false)
  }

  const handleEdit = () => {
    setShowDetails(false)
    onEdit(entry)
  }

  // Shared content for both Dialog and Drawer
  const entryDetailsContent = (
    <div className="space-y-4 py-4 px-4 md:px-0">
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-1">{config.intensityLabel}</p>
        <div className="flex items-center gap-2">
          <span
            className="text-2xl font-semibold"
            style={{ color: intensityColor }}
          >
            {entry.intensity}/10
          </span>
          <span className="text-base text-muted-foreground">
            ({intensityLabel})
          </span>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground mb-1">Date & Time</p>
        <p className="text-base">
          {new Date(entry.timestamp).toLocaleString('en-US', {
            dateStyle: 'full',
            timeStyle: 'short',
          })}
        </p>
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground mb-2">{config.locationLabel}</p>
        <div className="flex flex-wrap gap-2">
          {entry.locations.map(location => (
            <Badge key={location} variant="secondary" className="capitalize">
              {location.replace('-', ' ')}
            </Badge>
          ))}
        </div>
      </div>

      {entry.triggers.length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">{config.triggersLabel}</p>
          <div className="flex flex-wrap gap-2">
            {entry.triggers.map(trigger => (
              <Badge key={trigger} variant="outline">
                {trigger}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {entry.hashtags && entry.hashtags.length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Hashtags</p>
          <div className="flex flex-wrap gap-2">
            {entry.hashtags.map(tag => (
              <Badge key={tag} variant="secondary">
                <Hash size={12} className="mr-1" />
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {entry.notes && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">{config.notesLabel}</p>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {entry.notes}
            </p>
          </div>
        </div>
      )}
    </div>
  )

  // Shared action buttons for both Dialog and Drawer
  const actionButtons = (
    <>
      <Button
        variant="outline"
        onClick={handleEdit}
        className="gap-2"
      >
        <NotePencil size={16} />
        Edit
      </Button>
      <Button
        variant="destructive"
        onClick={() => setShowDeleteConfirm(true)}
        className="gap-2"
      >
        <Trash size={16} />
        Delete
      </Button>
    </>
  )

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Card
          className="cursor-pointer hover:shadow-md transition-all border-l-4"
          style={{ borderLeftColor: intensityColor }}
          onClick={() => setShowDetails(true)}
        >
          <CardContent className="p-5">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-lg font-semibold"
                      style={{ color: intensityColor }}
                    >
                      {entry.intensity}/10
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {intensityLabel}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(entry.timestamp)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {entry.locations.map(location => (
                  <Badge key={location} variant="secondary" className="capitalize">
                    {location.replace('-', ' ')}
                  </Badge>
                ))}
              </div>

              {entry.notes && (
                <p className="text-sm text-foreground/80 line-clamp-2">
                  {entry.notes}
                </p>
              )}

              {entry.triggers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {entry.triggers.map(trigger => (
                    <Badge key={trigger} variant="outline" className="text-xs">
                      {trigger}
                    </Badge>
                  ))}
                </div>
              )}

              {entry.hashtags && entry.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {entry.hashtags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      <Hash size={10} className="mr-0.5" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Mobile: Drawer with swipe-to-dismiss */}
      {isMobile ? (
        <Drawer open={showDetails} onOpenChange={setShowDetails}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle className="text-xl">{config.entryTitle}</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto flex-1">
              {entryDetailsContent}
            </div>
            <DrawerFooter className="flex-row justify-end gap-2">
              {actionButtons}
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        /* Desktop: Dialog */
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl">{config.entryTitle}</DialogTitle>
            </DialogHeader>
            {entryDetailsContent}
            <DialogFooter className="gap-2 sm:gap-2">
              {actionButtons}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Entry?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-4">
            {config.deleteConfirmMessage}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
