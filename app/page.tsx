import Link from 'next/link'
import { ProjectListClient } from '@/components/project-list-client'
import { Button } from '@/components/ui/button'
import { PlusIcon, LayoutDashboardIcon } from 'lucide-react'

export default function HomePage() {
  const adminSecret = process.env.ADMIN_PATH_SECRET ?? 'setup-required'
  const newProjectHref = `/p/${adminSecret}`

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <LayoutDashboardIcon className="size-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">コンテンツ制作管理</h1>
              <p className="text-sm text-muted-foreground">
                Instagram・X・イベント制作を一元管理
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href={newProjectHref}>
              <PlusIcon className="size-4" />
              新規プロジェクト
            </Link>
          </Button>
        </header>

        <ProjectListClient />
      </div>
    </main>
  )
}
