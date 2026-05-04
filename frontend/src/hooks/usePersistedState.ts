import { useState, useCallback } from 'react'

export function usePersistedState<T>(key: string, defaultValue: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved ? JSON.parse(saved) : defaultValue
    } catch {
      return defaultValue
    }
  })

  const setPersistedState = useCallback((updater: T | ((prev: T) => T)) => {
    setState(prev => {
      const next = typeof updater === 'function'
        ? (updater as (prev: T) => T)(prev)
        : updater
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch (e) {
        console.error('localStorage write failed:', key, e)
      }
      return next
    })
  }, [key])

  return [state, setPersistedState] as const
}
