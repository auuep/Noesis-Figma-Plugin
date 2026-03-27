import { lookupTag } from '../utils/tags'
import { sanitizeName } from '../utils/naming'

export interface NameReviewItem {
  nodeId: string
  nodePath: string[]    // breadcrumb: ancestor names + this node's name
  currentName: string
  suggestedName: string
  issues: string[]
}

function suggestName(rawName: string): string {
  const trimmed = rawName.trim()

  // Skip / comment prefixes are intentional — leave them alone
  if (trimmed.startsWith('_') || trimmed.startsWith('#')) return rawName

  const dotIdx = trimmed.indexOf('.')
  if (dotIdx > 0) {
    const candidate = trimmed.slice(0, dotIdx)
    const rest = trimmed.slice(dotIdx + 1).trim()

    const tagInfo = lookupTag(candidate)
    if (tagInfo) {
      // Valid tag — sanitize the name part and reassemble
      const sanitized = sanitizeName(rest)
      return sanitized ? `${tagInfo.tag}.${sanitized}` : tagInfo.tag
    } else {
      // Unknown tag — strip it, sanitize the remainder as a plain name
      const namePart = rest || candidate
      return sanitizeName(namePart)
    }
  }

  // Plain name — just sanitize
  return sanitizeName(trimmed)
}

function collectIssues(rawName: string): string[] {
  const issues: string[] = []
  const trimmed = rawName.trim()

  if (trimmed.startsWith('_') || trimmed.startsWith('#')) return issues

  const dotIdx = trimmed.indexOf('.')
  if (dotIdx > 0) {
    const candidate = trimmed.slice(0, dotIdx)
    const rest = trimmed.slice(dotIdx + 1).trim()

    const tagInfo = lookupTag(candidate)
    if (!tagInfo) {
      issues.push(`unknown tag "${candidate}"`)
    } else if (rest && sanitizeName(rest) !== rest) {
      issues.push('invalid characters in name')
    }
  } else {
    if (sanitizeName(trimmed) !== trimmed) {
      issues.push('invalid characters in name')
    }
  }

  return issues
}

function traverse(
  node: SceneNode,
  path: string[],
  results: NameReviewItem[]
): void {
  if ('visible' in node && node.visible === false) return

  const currentPath = [...path, node.name]
  const suggested = suggestName(node.name)

  if (suggested !== node.name) {
    results.push({
      nodeId: node.id,
      nodePath: currentPath,
      currentName: node.name,
      suggestedName: suggested,
      issues: collectIssues(node.name),
    })
  }

  if ('children' in node) {
    for (const child of (node as ChildrenMixin).children) {
      traverse(child as SceneNode, currentPath, results)
    }
  }
}

export function reviewLayerNames(selection: readonly SceneNode[]): NameReviewItem[] {
  const results: NameReviewItem[] = []
  for (const node of selection) {
    traverse(node, [], results)
  }
  return results
}
