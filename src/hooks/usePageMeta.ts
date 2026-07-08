import { useEffect } from 'react'

export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    const prev = document.title
    document.title = title
    return () => { document.title = prev }
  }, [title])

  useEffect(() => {
    if (!description) return
    const el = document.querySelector('meta[name="description"]')
    if (!el) return
    const prev = el.getAttribute('content')
    el.setAttribute('content', description)
    return () => { if (prev !== null) el.setAttribute('content', prev) }
  }, [description])
}
