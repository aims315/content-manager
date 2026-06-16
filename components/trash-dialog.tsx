'use client'

import { useState } from 'react'
import type { Project } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Trash2Icon, RotateCcwIcon, XIcon } from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

interface TrashDialogProps {
  deletedProjects: Project[]
  onRestore: (projectId: string) => Promise<boolean>
  onPermanentDelete: (projectId: string) => Promise<boolean>
  onEmptyTrash: () => Promise<boolean>
}

export function TrashDialog({ deletedProjects, onRestore, onPermanentDelete, onEmptyTrash }: TrashDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="size-9 relative" title="ゴミ箱">
          <Trash2Icon className="size-4" />
          {deletedProjects.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
              {deletedProjects.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2Icon className="size-4" />
            ゴミ箱
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            削除したプロジェクトはここに入ります。元に戻すか、完全に削除できます。
          </p>
          {deletedProjects.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs text-destructive hover:text-destructive shrink-0">
                  <Trash2Icon className="size-3" />全削除
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>ゴミ箱を空にしますか？</AlertDialogTitle>
                  <AlertDialogDescription>
                    ゴミ箱内の{deletedProjects.length}件すべてを完全に削除します。この操作は取り消せません。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => onEmptyTrash()}>
                    すべて完全に削除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {deletedProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Trash2Icon className="size-8 mb-2 opacity-40" />
            <p className="text-sm">ゴミ箱は空です</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {deletedProjects.map((p) => (
              <div key={p.id} className="rounded-lg border p-3 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.assignee}
                    {p.deleted_at && ` · 削除 ${format(new Date(p.deleted_at), 'M/d HH:mm', { locale: ja })}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs"
                    onClick={() => onRestore(p.id)}>
                    <RotateCcwIcon className="size-3" />元に戻す
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10">
                        <XIcon className="size-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>完全に削除しますか？</AlertDialogTitle>
                        <AlertDialogDescription>
                          「{p.title}」を完全に削除します。この操作は取り消せません。ステップや添付ファイルも全て削除されます。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => onPermanentDelete(p.id)}>
                          完全に削除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
