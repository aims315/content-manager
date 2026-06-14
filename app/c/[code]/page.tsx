import { ProjectListClient } from '@/components/project-list-client'
import { LayoutDashboardIcon } from 'lucide-react'

interface Props {
  params: Promise<{ code: string }>
}

export default async function CodeLockedPage({ params }: Props) {
  const { code } = await params
  const decoded = decodeURIComponent(code)

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <header className="flex items-center gap-3 mb-8">
          <LayoutDashboardIcon className="size-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{decoded}</h1>
            <p className="text-sm text-muted-foreground">コンテンツ制作管理（このコード専用）</p>
          </div>
        </header>

        <ProjectListClient lockedCode={decoded} />
      </div>
    </main>
  )
}
