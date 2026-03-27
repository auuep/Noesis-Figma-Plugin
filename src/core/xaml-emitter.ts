import { XamlNode, PropertyElement } from './ir'

export interface EmitOptions {
  indent: number        // spaces per indent level (default 2)
  includeNamespaces: boolean
}

const DEFAULT_OPTIONS: EmitOptions = {
  indent: 2,
  includeNamespaces: true,
}

const XAML_NAMESPACES = [
  'xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"',
  'xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"',
]

/**
 * Serialize an IR tree to a XAML string.
 */
export function emitXaml(root: XamlNode, options: Partial<EmitOptions> = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const lines: string[] = []
  emitNode(root, lines, 0, opts, /* isRoot */ true)
  return lines.join('\n')
}

function emitNode(
  node: XamlNode,
  lines: string[],
  depth: number,
  opts: EmitOptions,
  isRoot: boolean = false,
): void {
  const pad = ' '.repeat(depth * opts.indent)

  // XML comment
  if (node.comment) {
    lines.push(`${pad}<!-- ${escapeComment(node.comment)} -->`)
  }

  // Collect all attributes
  const attrs: string[] = []

  // Namespaces on root only
  if (isRoot && opts.includeNamespaces) {
    attrs.push(...XAML_NAMESPACES)
  }

  if (node.name) {
    attrs.push(`x:Name="${node.name}"`)
  }

  for (const [key, value] of Object.entries(node.attributes)) {
    attrs.push(`${key}="${escapeAttr(value)}"`)
  }

  const hasChildren = node.children.length > 0
  const hasPropertyElements = (node.propertyElements?.length ?? 0) > 0
  const hasContent = !!node.content
  const hasBody = hasChildren || hasPropertyElements || hasContent

  if (node.selfClosing || (!hasBody && !node.children.length)) {
    // Self-closing element
    const attrStr = formatAttrs(attrs, pad, opts.indent, node.tag)
    lines.push(`${pad}<${node.tag}${attrStr}/>`)
  } else {
    // Opening tag
    const attrStr = formatAttrs(attrs, pad, opts.indent, node.tag)
    lines.push(`${pad}<${node.tag}${attrStr}>`)

    // Property elements (e.g. <Button.Background>)
    if (hasPropertyElements) {
      for (const pe of node.propertyElements!) {
        emitPropertyElement(pe, lines, depth + 1, opts)
      }
    }

    // Inline text content
    if (hasContent && !hasChildren) {
      lines.push(`${pad}  ${escapeText(node.content!)}`)
    }

    // Child nodes
    for (const child of node.children) {
      emitNode(child, lines, depth + 1, opts)
    }

    lines.push(`${pad}</${node.tag}>`)
  }
}

function emitPropertyElement(pe: PropertyElement, lines: string[], depth: number, opts: EmitOptions): void {
  const pad = ' '.repeat(depth * opts.indent)
  lines.push(`${pad}<${pe.property}>`)
  for (const child of pe.children) {
    emitNode(child, lines, depth + 1, opts)
  }
  lines.push(`${pad}</${pe.property}>`)
}

/**
 * Format attributes: inline if short, multi-line if long.
 */
function formatAttrs(attrs: string[], pad: string, indent: number, tag: string): string {
  if (attrs.length === 0) return ''

  const inline = ' ' + attrs.join(' ')
  // Keep inline if total line length is reasonable
  if ((pad + tag + inline).length <= 120 || attrs.length === 1) {
    return inline
  }

  // Multi-line
  const attrPad = pad + ' '.repeat(indent)
  return '\n' + attrs.map(a => `${attrPad}${a}`).join('\n') + '\n' + pad
}

function escapeAttr(value: string): string {
  // Don't escape binding expressions or resource references
  if (value.startsWith('{')) return value
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeText(value: string): string {
  if (value.startsWith('{')) return value
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeComment(value: string): string {
  return value.replace(/--/g, '- -')
}
