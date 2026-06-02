import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import { SubmitForm } from '@/components/submit-form'

interface Props {
  params: Promise<{ secret: string }>
}

export default async function SecretAdminPage({ params }: Props) {
  const { secret } = await params
  const adminSecret = process.env.ADMIN_PATH_SECRET

  if (!adminSecret || secret !== adminSecret) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <div className="mb-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <Link
              href="https://v0-task-management-app-six-inky.vercel.app"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeftIcon className="size-4" />
              管理画面に戻る
            </Link>
            <a href={`/p/${secret}/settings`} className="text-xs text-muted-foreground hover:text-foreground shrink-0">
              Discord設定
            </a>
          </div>
          <h1 className="text-2xl font-bold">タスク送信</h1>
          <p className="text-sm text-muted-foreground mt-1">新規タスクの依頼・修正指示の送信ができます</p>
        </div>
        <SubmitForm />
      </div>
    </main>
  )
}
