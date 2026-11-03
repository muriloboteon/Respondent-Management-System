import { useEffect, useState } from 'react'

/**
 * State remembered in localStorage across visits. Stored values that fail `isValid`
 * fall back to `initial`.
 */
export function useStoredState<T>(key: string, initial: T, isValid: (v: unknown) => v is T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
      return isValid(parsed) ? parsed : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage can be unavailable (private mode, blocked site data); the value then lasts for the session only.
    }
  }, [key, value])
  return [value, setValue] as const
}
