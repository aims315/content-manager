import { notFound } from 'next/navigation'
import { ChannelSettingsForm } from '@/components/channel-settings-form'

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
        <div className="mb-6 flex items-center gap-3">
          <a href="https://v0-task-management-app-six-inky.vercel.app/" className="text-sm text-muted-foreground hover:text-foreground">← 管理画面へ戻る</a>
        </div>
        <h1 className="text-2xl font-bold mb-6">Discord通知チャンネル設定</h1>
        <ChannelSettingsForm />
      </div>
    </div>
  )
}
