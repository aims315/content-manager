'use client'

import { useState, useEffect, useCallback } from 'react'

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (val: T) => void] {
  const [value, setValue] = useState<T>(defaultValue)

  // マウント後にlocalStorageから読み込む
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key)
      if (saved !== null) setValue(JSON.parse(saved))
    } catch {}
  }, [key])

  const set = useCallback((val: T) => {
    setValue(val)
    try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
  }, [key])

  return [value, set]
}
