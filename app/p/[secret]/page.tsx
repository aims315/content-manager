import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import { ProjectForm } from '@/components/project-form'

interface Props {
  params: Promise<{ secret: string }>
}

export default async function AdminPage({ params }: Props) {
  const { secret } = await params
  const adminSecret = process.env.ADMIN_PATH_SECRET

  if (!adminSecret || secret !== adminSecret) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeftIcon className="size-4" />
            一覧に戻る
          </Link>
          <h1 className="text-2xl font-bold">新規プロジェクト</h1>
          <p className="text-sm text-muted-foreground mt-1">制作種別を選択してプロジェクトを作成します</p>
        </div>
        <ProjectForm />
      </div>
    </main>
  )
}
