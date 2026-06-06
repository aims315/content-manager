import Link from 'next/link'
import { TaskListClient } from '@/components/task-list-client'
import { Button } from '@/components/ui/button'
import { PlusIcon, ClipboardListIcon } from 'lucide-react'

export default function HomePage() {
  const adminSecret = process.env.ADMIN_PATH_SECRET ?? 'setup-required'
  const newTaskHref = `/p/${adminSecret}`

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <ClipboardListIcon className="size-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">タスク管理</h1>
              <p className="text-sm text-muted-foreground">
                チームのタスクを効率的に管理しましょう
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/p/${adminSecret}/settings`} className="text-xs text-muted-foreground hover:text-foreground">
              Discord設定
            </Link>
            <Button asChild>
              <Link href={newTaskHref}>
                <PlusIcon className="size-4" />
                新規タスク
              </Link>
            </Button>
          </div>
        </header>

        <TaskListClient />
      </div>
    </main>
  )
}
