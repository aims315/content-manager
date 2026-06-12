import { ShareView } from '@/components/share-view'

interface Props {
  params: Promise<{ code: string }>
}

export default async function SharePage({ params }: Props) {
  const { code } = await params
  return <ShareView code={decodeURIComponent(code)} />
}
