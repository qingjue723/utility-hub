import { useEffect, useRef, useState } from 'react'
import { readStoredValue, removeStoredValue, writeStoredValue } from '../lib/storage'

export function usePersistentState<T>(key: string, createDefault: () => T) {
  const [value, setValue] = useState<T>(() => readStoredValue<T>(key) ?? createDefault())
  const skipNextWrite = useRef(false)

  useEffect(() => {
    if (skipNextWrite.current) {
      skipNextWrite.current = false
      return
    }
    writeStoredValue(key, value)
  }, [key, value])

  function reset() {
    removeStoredValue(key)
    skipNextWrite.current = true
    setValue(createDefault())
  }

  return [value, setValue, reset] as const
}
