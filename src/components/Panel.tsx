export function Panel({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="tool-section">
      <div className="tool-section-head">
        <div className="tool-section-title">{title}</div>
        {actions && <div className="tool-section-actions">{actions}</div>}
      </div>
      {children}
    </section>
  )
}
