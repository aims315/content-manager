import Link from 'next/link'
import { ProjectListClient } from '@/components/project-list-client'
import { ProviderSettingsModal } from '@/components/provider-settings-modal'
import { CsvImportDialog } from '@/components/csv-import-dialog'
import { CsvExportButton } from '@/components/csv-export-button'
import { BulkEditDialog } from '@/components/bulk-edit-dialog'
import { SyncAllButton } from '@/components/sync-all-button'
import { AdminAuthGuard } from '@/components/admin-auth-guard'
import { Button } from '@/components/ui/button'
import { PlusIcon, LayoutDashboardIcon, SettingsIcon } from 'lucide-react'

export default function HomePage() {
  const adminSecret = process.env.ADMIN_PATH_SECRET ?? 'setup-required'
  const newProjectHref = `/p/${adminSecret}`
  const settingsHref = `/p/${adminSecret}/settings`
  // 既定はパスワード保護あり。NEXT_PUBLIC_REQUIRE_AUTH=false のサイトだけ解除。
  const requireAuth = process.env.NEXT_PUBLIC_REQUIRE_AUTH !== 'false'

  const content = (
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
          <div className="flex items-center gap-2">
            {process.env.ENABLE_TASK_SYNC === 'true' && <SyncAllButton />}
            <BulkEditDialog />
            <CsvExportButton />
            <CsvImportDialog />
            <ProviderSettingsModal />
            <Button variant="ghost" size="icon" asChild>
              <Link href={settingsHref}>
                <SettingsIcon className="size-4" />
              </Link>
            </Button>
            <Button asChild>
              <Link href={newProjectHref}>
                <PlusIcon className="size-4" />
                新規プロジェクト
              </Link>
            </Button>
          </div>
        </header>

        <ProjectListClient />
      </div>
    </main>
  )

  return requireAuth ? <AdminAuthGuard>{content}</AdminAuthGuard> : content
}
