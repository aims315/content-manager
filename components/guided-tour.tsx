'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { XIcon } from 'lucide-react'

export interface TourStep {
  target: string // data-tour attribute value
  title: string
  body: string
}

interface GuidedTourProps {
  steps: TourStep[]
  open: boolean
  onFinish: () => void
}

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export function GuidedTour({ steps, open, onFinish }: GuidedTourProps) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)

  useEffect(() => {
    if (!open) return
    setIndex(0)
  }, [open])

  useEffect(() => {
    if (!open) return
    const step = steps[index]
    if (!step) return

    const update = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`)
      if (!el) {
        setRect(null)
        return
      }
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const t = setTimeout(update, 300)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      clearTimeout(t)
    }
  }, [open, index, steps])

  if (!open) return null
  const step = steps[index]
  if (!step) return null

  const isLast = index === steps.length - 1

  const cardTop = rect ? rect.top + rect.height + 12 : window.innerHeight / 2 - 80
  const cardLeft = rect ? Math.min(Math.max(rect.left, 16), window.innerWidth - 336) : window.innerWidth / 2 - 160

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/50" onClick={onFinish} />
      {rect && (
        <div
          className="absolute rounded-md ring-2 ring-primary ring-offset-2 ring-offset-background pointer-events-none transition-all"
          style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }}
        />
      )}
      <div
        className="absolute w-80 rounded-lg bg-background p-4 shadow-xl border transition-all"
        style={{ top: cardTop, left: cardLeft }}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-sm font-semibold">{step.title}</p>
          <button onClick={onFinish} className="text-muted-foreground hover:text-foreground shrink-0">
            <XIcon className="size-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{step.body}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`size-1.5 rounded-full ${i === index ? 'bg-primary' : 'bg-muted'}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onFinish}>スキップ</Button>
            <Button
              size="sm"
              onClick={() => (isLast ? onFinish() : setIndex((i) => i + 1))}
            >
              {isLast ? '完了' : '次へ'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
