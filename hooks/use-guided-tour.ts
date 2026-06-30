'use client'

import { useEffect, useState } from 'react'

export function useGuidedTour(storageKey: string, autoStart: boolean) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!autoStart) return
    const done = window.localStorage.getItem(storageKey)
    if (!done) setOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart])

  const start = () => setOpen(true)
  const finish = () => {
    window.localStorage.setItem(storageKey, '1')
    setOpen(false)
  }

  return { open, start, finish }
}
