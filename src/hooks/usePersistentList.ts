import { useEffect, useState } from 'react'
import { readStoredValue, writeStoredValue } from '../lib/storage'

export function usePersistentList(key: string) {
  const [items, setItems] = useState<string[]>(() => readStoredValue<string[]>(key) ?? [])

  useEffect(() => {
    writeStoredValue(key, items)
  }, [items, key])

  function toggle(item: string) {
    setItems((current) => (current.includes(item) ? current.filter((id) => id !== item) : [item, ...current]))
  }

  function add(item: string) {
    setItems((current) => [item, ...current.filter((id) => id !== item)].slice(0, 8))
  }

  return { items, toggle, add }
}
