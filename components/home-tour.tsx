'use client'

import { Button } from '@/components/ui/button'
import { GuidedTour, type TourStep } from '@/components/guided-tour'
import { useGuidedTour } from '@/hooks/use-guided-tour'
import { HelpCircleIcon } from 'lucide-react'

const STEPS: TourStep[] = [
  { target: 'new-project-button', title: '新規プロジェクトの作成', body: 'ここからInstagram・X・イベントなどのプロジェクトを作成します。クライアントごとに制作ステップが自動で設定されます。' },
  { target: 'project-grid', title: 'プロジェクトカード', body: 'プロジェクトはカード形式で一覧表示されます。進捗・締切が一目でわかります。' },
  { target: 'step-manager', title: 'ステップ管理', body: '各プロジェクトの制作ステップ（構成→デザイン→チェック→納品）をここで管理できます。' },
  { target: 'view-toggle', title: '表示切り替え', body: '「制作管理」と「スケジュール」を切り替えて、ガントチャートやカレンダーで締切も確認できます。' },
]

export function HomeTour() {
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
  const { open, start, finish } = useGuidedTour('tour-task-content-done', demoMode)

  return (
    <>
      <Button variant="ghost" size="sm" onClick={start} className="gap-1.5 text-muted-foreground">
        <HelpCircleIcon className="size-4" />
        使い方ガイド
      </Button>
      <GuidedTour steps={STEPS} open={open} onFinish={finish} />
    </>
  )
}
