// Plugin UI logic — runs in the Figma iframe
import JSZip from 'jszip'

// ── Types (mirrored from main.ts) ──────────────────────────────────────────

interface XamlReadyMessage {
  type: 'xaml-ready'
  xaml: string
  hasSelection: boolean
  nodeCount: number
  warnings: string[]
}

interface ExportReadyMessage {
  type: 'export-ready'
  files: Array<{ filename: string; content: string | number[] }>
}

interface NameReviewItem {
  nodeId: string
  nodePath: string[]
  currentName: string
  suggestedName: string
  issues: string[]
}

interface NamesReviewedMessage {
  type: 'names-reviewed'
  items: NameReviewItem[]
  hasSelection: boolean
}

interface RenamesAppliedMessage {
  type: 'renames-applied'
  count: number
}

type PluginMessage = XamlReadyMessage | ExportReadyMessage | NamesReviewedMessage | RenamesAppliedMessage

// ── State ──────────────────────────────────────────────────────────────────

let currentXaml = ''
let isExporting = false
let pendingRenames: Array<{ nodeId: string; newName: string }> = []
let activeTab: 'xaml' | 'names' = 'xaml'

// ── DOM refs ───────────────────────────────────────────────────────────────

const headerMeta = document.getElementById('header-meta')!
const xamlOutput = document.getElementById('xaml-output')!
const emptyState = document.getElementById('empty-state')!
const previewArea = document.getElementById('preview-area')!
const statusDot = document.getElementById('status-dot')!
const statusText = document.getElementById('status-text')!
const statusLines = document.getElementById('status-lines')!
const warningsEl = document.getElementById('warnings')!
const warningsList = document.getElementById('warnings-list')!
const toast = document.getElementById('toast')!
const btnCopy = document.getElementById('btn-copy')!
const btnExport = document.getElementById('btn-export')!
const btnRefresh = document.getElementById('btn-refresh')!
const optNamespaces = document.getElementById('opt-namespaces') as HTMLInputElement
const optResources = document.getElementById('opt-resources') as HTMLInputElement
const optIndent = document.getElementById('opt-indent') as HTMLSelectElement
const tabXaml = document.getElementById('tab-xaml')!
const tabNames = document.getElementById('tab-names')!
const reviewArea = document.getElementById('review-area')!
const reviewEmpty = document.getElementById('review-empty')!
const reviewList = document.getElementById('review-list')!
const reviewFooter = document.getElementById('review-footer')!
const reviewCount = document.getElementById('review-count')!
const btnApply = document.getElementById('btn-apply')!

// ── Receive messages from plugin main thread ───────────────────────────────

window.onmessage = (event: MessageEvent) => {
  const msg = event.data.pluginMessage as PluginMessage
  if (!msg) return

  switch (msg.type) {
    case 'xaml-ready':
      handleXamlReady(msg)
      break
    case 'export-ready':
      handleExportReady(msg)
      break
    case 'names-reviewed':
      handleNamesReviewed(msg)
      break
    case 'renames-applied':
      handleRenamesApplied(msg)
      break
  }
}

function handleXamlReady(msg: XamlReadyMessage): void {
  if (!msg.hasSelection || !msg.xaml) {
    showEmptyState()
    updateStatus(false, 'No selection', '')
    return
  }

  currentXaml = msg.xaml
  const lineCount = msg.xaml.split('\n').length

  showPreview(highlightXaml(msg.xaml))
  updateStatus(true, `${msg.nodeCount} element${msg.nodeCount !== 1 ? 's' : ''}`, `${lineCount} lines`)
  headerMeta.textContent = `${msg.nodeCount} node${msg.nodeCount !== 1 ? 's' : ''}`

  if (msg.warnings.length > 0) {
    warningsEl.classList.add('visible')
    warningsList.innerHTML = msg.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')
  } else {
    warningsEl.classList.remove('visible')
  }
}

async function handleExportReady(msg: ExportReadyMessage): Promise<void> {
  isExporting = false
  btnExport.textContent = '↓ Export .zip'

  const zip = new JSZip()

  for (const file of msg.files) {
    if (typeof file.content === 'string') {
      zip.file(file.filename, file.content)
    } else {
      // number[] → Uint8Array
      zip.file(file.filename, new Uint8Array(file.content))
    }
  }

  const blob: Blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  downloadBlob(blob, 'noesis-ui.zip')
  showToast('Exported noesis-ui.zip')
}

function handleNamesReviewed(msg: NamesReviewedMessage): void {
  pendingRenames = msg.items.map(item => ({ nodeId: item.nodeId, newName: item.suggestedName }))

  if (!msg.hasSelection || msg.items.length === 0) {
    reviewList.innerHTML = ''
    reviewEmpty.style.display = 'flex'
    reviewFooter.style.display = 'none'
    return
  }

  reviewEmpty.style.display = 'none'
  reviewFooter.style.display = 'flex'
  reviewCount.textContent = `${msg.items.length} issue${msg.items.length !== 1 ? 's' : ''}`
  reviewList.innerHTML = msg.items.map(renderDiffItem).join('')
}

function renderDiffItem(item: NameReviewItem): string {
  const parentPath = item.nodePath.slice(0, -1)
  const pathHtml = parentPath.length > 0
    ? `<div class="diff-path">${escapeHtml(parentPath.join(' › '))}</div>`
    : ''

  const issueHtml = item.issues.length > 0
    ? `<div class="diff-issues">${item.issues.map(i => `<span class="diff-issue-tag">${escapeHtml(i)}</span>`).join('')}</div>`
    : ''

  return `<div class="diff-item">
  ${pathHtml}
  <div class="diff-rows">
    <div class="diff-old">- ${escapeHtml(item.currentName)}</div>
    <div class="diff-new">+ ${escapeHtml(item.suggestedName)}</div>
  </div>
  ${issueHtml}
</div>`
}

function handleRenamesApplied(msg: RenamesAppliedMessage): void {
  ;(btnApply as HTMLButtonElement).disabled = false
  btnApply.textContent = 'Apply renames'
  showToast(`Renamed ${msg.count} layer${msg.count !== 1 ? 's' : ''}`)
  parent.postMessage({ pluginMessage: { type: 'review-names' } }, '*')
}

// ── Send messages to plugin main thread ────────────────────────────────────

function getOptions() {
  return {
    indent: parseInt(optIndent.value, 10),
    includeNamespaces: optNamespaces.checked,
    includeResources: optResources.checked,
  }
}

function requestGenerate(): void {
  parent.postMessage({ pluginMessage: { type: 'generate', options: getOptions() } }, '*')
}

function requestExport(): void {
  if (isExporting) return
  isExporting = true
  btnExport.textContent = 'Exporting...'
  parent.postMessage({ pluginMessage: { type: 'export', options: getOptions() } }, '*')
}

// ── Button handlers ────────────────────────────────────────────────────────

// ── Tab switching ──────────────────────────────────────────────────────────

function switchTab(tab: 'xaml' | 'names'): void {
  activeTab = tab
  tabXaml.classList.toggle('active', tab === 'xaml')
  tabNames.classList.toggle('active', tab === 'names')

  const isXaml = tab === 'xaml'
  previewArea.style.display = isXaml ? 'block' : 'none'
  reviewArea.style.display = isXaml ? 'none' : 'block'
  reviewFooter.style.display = (!isXaml && pendingRenames.length > 0) ? 'flex' : 'none'
}

tabXaml.addEventListener('click', () => switchTab('xaml'))
tabNames.addEventListener('click', () => {
  switchTab('names')
  parent.postMessage({ pluginMessage: { type: 'review-names' } }, '*')
})

btnApply.addEventListener('click', () => {
  if (pendingRenames.length === 0) return
  ;(btnApply as HTMLButtonElement).disabled = true
  btnApply.textContent = 'Applying...'
  parent.postMessage({ pluginMessage: { type: 'apply-renames', renames: pendingRenames } }, '*')
})

// ── Button handlers ────────────────────────────────────────────────────────

btnCopy.addEventListener('click', () => {
  if (!currentXaml) return
  navigator.clipboard.writeText(currentXaml).then(() => {
    showToast('XAML copied to clipboard')
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea')
    ta.value = currentXaml
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    showToast('XAML copied to clipboard')
  })
})

btnExport.addEventListener('click', requestExport)
btnRefresh.addEventListener('click', requestGenerate)

// Re-generate when settings change
optNamespaces.addEventListener('change', requestGenerate)
optResources.addEventListener('change', requestGenerate)
optIndent.addEventListener('change', () => {
  if (currentXaml) showPreview(highlightXaml(currentXaml))
  requestGenerate()
})

// ── Syntax highlighting ────────────────────────────────────────────────────

function highlightXaml(xml: string): string {
  // Escape HTML first
  let s = escapeHtml(xml)

  // Comments
  s = s.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="xc">$1</span>')

  // Tags: <TagName or </TagName or />
  s = s.replace(/(&lt;\/?)([\w:.]+)/g, (_, punct, tag) =>
    `<span class="xp">${punct}</span><span class="xt">${tag}</span>`
  )

  // Self-close and close punctuation
  s = s.replace(/(\/?&gt;)/g, '<span class="xp">$1</span>')

  // Attribute names (word= pattern before a quote)
  s = s.replace(/([\w:.]+)(=&quot;)/g, (_, name, eq) =>
    `<span class="xa">${name}</span><span class="xp">${eq}</span>`
  )

  // Attribute values (content between &quot;...&quot;)
  s = s.replace(/(&quot;)([^&]*)(&quot;)/g, (_, q1, val, q2) => {
    const valSpan = val.startsWith('{')
      ? `<span class="xb">${escapeHtml(val)}</span>`
      : `<span class="xs">${val}</span>`
    return `<span class="xp">${q1}</span>${valSpan}<span class="xp">${q2}</span>`
  })

  return s
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── UI helpers ─────────────────────────────────────────────────────────────

function showPreview(html: string): void {
  emptyState.style.display = 'none'
  xamlOutput.style.display = 'block'
  xamlOutput.innerHTML = html
}

function showEmptyState(): void {
  emptyState.style.display = 'flex'
  xamlOutput.style.display = 'none'
  currentXaml = ''
}

function updateStatus(ready: boolean, text: string, lines: string): void {
  statusDot.className = 'status-dot' + (ready ? ' ready' : '')
  statusText.textContent = text
  statusLines.textContent = lines
}

let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(message: string): void {
  toast.textContent = message
  toast.classList.add('show')
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000)
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

