import type { ReactNode } from 'react'
import type { ToolDefinition } from '../tools/registry'

export function ToolShell({ tool, children }: { tool: ToolDefinition; children: ReactNode }) {
  return (
    <main className="page tool-page" data-tool={tool.id}>
      {children}
    </main>
  )
}
