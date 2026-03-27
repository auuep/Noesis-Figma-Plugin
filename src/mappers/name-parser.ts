import { lookupTag, TagInfo } from '../utils/tags'
import { sanitizeName } from '../utils/naming'

export interface ParsedName {
  tagInfo?: TagInfo          // resolved tag, if a known tag was found
  name?: string              // x:Name (sanitized)
  rawTag?: string            // original tag string before lookup
  isSkipped: boolean         // underscore prefix → skip export
  isComment: boolean         // hash prefix → emit as XML comment
  commentText?: string
}

export interface DescriptionProps {
  // Keyed XAML property overrides from description field
  // e.g. { 'Grid.Row': '0', 'Command': '{Binding StartCmd}' }
  [key: string]: string
}

/**
 * Parse a Figma layer name into its XAML tag + x:Name parts.
 *
 * Syntax: Tag.Name  or just  Name
 * Examples:
 *   "Button.StartGame"   → tagInfo=Button, name="StartGame"
 *   "Grid.MainLayout"    → tagInfo=Grid,   name="MainLayout"
 *   "MyFrame"            → tagInfo=undefined, name="MyFrame"
 *   "_hidden"            → isSkipped=true
 *   "#This is a comment" → isComment=true
 */
export function parseLayerName(rawName: string): ParsedName {
  const trimmed = rawName.trim()

  // Skip: underscore prefix
  if (trimmed.startsWith('_')) {
    return { isSkipped: true, isComment: false }
  }

  // Comment: hash prefix
  if (trimmed.startsWith('#')) {
    return { isSkipped: false, isComment: true, commentText: trimmed.slice(1).trim() }
  }

  // Try to split on first dot
  const dotIdx = trimmed.indexOf('.')
  if (dotIdx > 0) {
    const candidate = trimmed.slice(0, dotIdx)
    const rest = trimmed.slice(dotIdx + 1).trim()

    const tagInfo = lookupTag(candidate)
    if (tagInfo) {
      const name = rest ? sanitizeName(rest) : undefined
      return { tagInfo, name, rawTag: candidate, isSkipped: false, isComment: false }
    }
  }

  // No recognized tag → plain name
  const name = sanitizeName(trimmed) || undefined
  return { isSkipped: false, isComment: false, name }
}

/**
 * Parse a node's description field into a key=value property map.
 *
 * Each non-empty line is treated as "Key=Value".
 * Values may contain '=' (e.g. binding expressions).
 */
export function parseDescription(description: string | undefined): DescriptionProps {
  if (!description) return {}

  const props: DescriptionProps = {}
  for (const line of description.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 1) continue

    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    if (key) props[key] = value
  }
  return props
}
