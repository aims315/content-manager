import { ClientSubmitForm } from '@/components/client-submit-form'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function ClientSubmitPage({ params }: Props) {
  const { slug } = await params
  return <ClientSubmitForm clientSlug={slug} />
}
