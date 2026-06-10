import { StepSubmitForm } from '@/components/step-submit-form'

interface Props {
  params: Promise<{ stepId: string }>
}

export default async function StepSubmitPage({ params }: Props) {
  const { stepId } = await params
  return <StepSubmitForm stepId={stepId} />
}
