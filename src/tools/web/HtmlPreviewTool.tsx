import { useState } from 'react'
import { useLocale } from '../../app/providers/LocaleProvider'
import { Panel } from '../../components/Panel'
import { usePersistentState } from '../../hooks/usePersistentState'

function makeStarter(title: string, body: string) {
  return `<!doctype html>\n<html>\n  <head>\n    <meta charset="utf-8" />\n    <style>body{font-family:serif;padding:40px;background:#f7f4ee;color:#1d1d1b} h1{font-size:42px}</style>\n  </head>\n  <body>\n    <h1>${title}</h1>\n    <p>${body}</p>\n  </body>\n</html>`
}

function escapeSrcDoc(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function makePreviewWindowDocument(html: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>HTML Preview</title>
    <style>
      html,body{margin:0;width:100%;height:100%;background:#0c0c0c}
      iframe{width:100%;height:100%;border:0;background:#fff}
    </style>
  </head>
  <body>
    <iframe title="HTML Preview" sandbox="allow-scripts allow-modals" referrerpolicy="no-referrer" srcdoc="${escapeSrcDoc(html)}"></iframe>
  </body>
</html>`
}

export function HtmlPreviewTool() {
  const { t } = useLocale()
  const starter = makeStarter(t.sampleHtmlTitle, t.sampleHtmlBody)
  const [input, setInput, resetInput] = usePersistentState('utility-hub-tool-state:html-preview', () => starter)
  const [openError, setOpenError] = useState(false)

  function openInNewWindow() {
    setOpenError(false)
    const previewWindow = window.open('', '_blank')
    if (!previewWindow) {
      setOpenError(true)
      return
    }

    previewWindow.opener = null
    previewWindow.document.open()
    previewWindow.document.write(makePreviewWindowDocument(input))
    previewWindow.document.close()
  }

  return (
    <div className="tool-workspace two-col wide html-preview-workspace">
      <Panel title="HTML" actions={<button className="text-button" type="button" onClick={resetInput}>{t.restoreDefaults}</button>}><textarea className="large-tool-area mono tall html-preview-source" value={input} onChange={(event) => setInput(event.target.value)} /></Panel>
      <section className="tool-section html-preview-section">
        <div className="tool-section-head">
          <div className="tool-section-title">{t.preview}</div>
          <div className="tool-section-actions"><button className="text-button" type="button" onClick={openInNewWindow}>{t.openPreviewWindow}</button></div>
        </div>
        {openError && <p className="error-text">{t.popupBlocked}</p>}
        <iframe className="preview-frame large-tool-area" title={t.preview} sandbox="allow-scripts allow-modals" referrerPolicy="no-referrer" srcDoc={input} />
      </section>
    </div>
  )
}
