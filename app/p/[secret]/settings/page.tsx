import { notFound } from 'next/navigation'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'

interface Props {
  params: Promise<{ secret: string }>
}

export default async function SettingsPage({ params }: Props) {
  const { secret } = await params
  const adminSecret = process.env.ADMIN_PATH_SECRET
  if (!adminSecret || secret !== adminSecret) notFound()

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeftIcon className="size-4" />
            一覧に戻る
          </Link>
        </div>
        <h1 className="text-2xl font-bold mb-6">設定</h1>
        <p className="text-sm text-muted-foreground">設定項目は今後追加予定です。</p>
      </div>
    </div>
  )
}
