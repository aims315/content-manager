import type { ProjectType, ProviderType, StepKey } from './types'

export interface StepDef {
  key: StepKey
  label: string
  description: string
  defaultProvider: ProviderType
  requires: StepKey[]
}

export const STEPS_CONFIG: Record<ProjectType, StepDef[]> = {
  instagram: [
    { key: 'photo', label: '写真素材', description: '投稿に使う写真', defaultProvider: 'client', requires: [] },
    { key: 'text', label: 'テキスト素材', description: '投稿キャプション・本文', defaultProvider: 'client', requires: [] },
    { key: 'design', label: 'デザイン制作', description: '写真・テキストが揃ったらデザインを作成', defaultProvider: 'self', requires: ['photo', 'text'] },
    { key: 'post_ready', label: '投稿完成', description: '最終確認・納品', defaultProvider: 'self', requires: ['design'] },
  ],
  twitter: [
    { key: 'text', label: 'テキスト素材', description: 'ツイート本文', defaultProvider: 'client', requires: [] },
    { key: 'photo', label: '写真素材（任意）', description: '添付画像（任意）', defaultProvider: 'client', requires: [] },
    { key: 'post_ready', label: '投稿完成', description: '最終確認・納品', defaultProvider: 'self', requires: ['text'] },
  ],
  event: [
    { key: 'event_outline', label: 'イベント概要', description: 'イベントの概要・目的・対象', defaultProvider: 'self', requires: [] },
    { key: 'announce_image', label: '告知画像', description: 'イベント告知用の画像', defaultProvider: 'self', requires: ['event_outline'] },
    { key: 'event_script', label: 'イベント進行台本', description: '当日の進行台本', defaultProvider: 'self', requires: ['event_outline'] },
    { key: 'event_page', label: 'イベントページ', description: 'LP・申込ページ', defaultProvider: 'self', requires: ['event_outline'] },
    { key: 'invite_email', label: '案内メール', description: '参加者への案内メール', defaultProvider: 'self', requires: ['event_page'] },
    { key: 'thanks_email', label: 'サンクスメール', description: '終了後のお礼メール', defaultProvider: 'self', requires: ['invite_email'] },
    { key: 'thanks_line', label: 'サンクスLINE', description: '終了後のお礼LINE', defaultProvider: 'self', requires: ['invite_email'] },
  ],
}

export function getStepDef(type: ProjectType, key: StepKey): StepDef | undefined {
  return STEPS_CONFIG[type].find((s) => s.key === key)
}

export function isStepUnlocked(requires: StepKey[], completedKeys: StepKey[]): boolean {
  return requires.every((req) => completedKeys.includes(req))
}
