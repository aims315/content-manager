import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { ChannelSettingsForm } from '@/components/channel-settings-form'
import { CalendarFeedSection } from '@/components/calendar-feed-section'
import { DeliveryExportSection } from '@/components/delivery-export-section'

interface Props {
  params: Promise<{ secret: string }>
}

export default async function SettingsPage({ params }: Props) {
  const { secret } = await params
  const adminSecret = process.env.ADMIN_PATH_SECRET
  if (!adminSecret || secret !== adminSecret) notFound()

  const headersList = await headers()
  const host = headersList.get('host') ?? ''
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const baseUrl = `${protocol}://${host}`
  const calendarUrl = `${baseUrl}/api/calendar?token=${secret}`

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <a href="https://v0-task-management-app-six-inky.vercel.app/" className="text-sm text-muted-foreground hover:text-foreground">← 管理画面へ戻る</a>
        </div>
        <h1 className="text-2xl font-bold mb-6">設定</h1>
        <div className="space-y-8">
          <div>
            <h2 className="text-lg font-semibold mb-4">Discord通知チャンネル設定</h2>
            <ChannelSettingsForm />
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-4">Googleカレンダー連携</h2>
            <CalendarFeedSection calendarUrl={calendarUrl} />
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-4">納品データ一覧（Googleスプレッドシート連携）</h2>
            <DeliveryExportSection exportUrl={`${baseUrl}/api/export/deliveries?token=${secret}`} />
          </div>
        </div>
      </div>
    </div>
  )
}
