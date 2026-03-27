import { XamlNode, PropertyElement, makeNode } from '../core/ir'
import { figmaColorToXaml } from '../utils/color'
import { convertEffects } from './effects'

/**
 * Convert a Figma TEXT node to a TextBlock XAML element.
 */
export function convertText(node: TextNode): XamlNode {
  const attrs: Record<string, string> = {}
  const propElements: PropertyElement[] = []

  const opacity = node.opacity ?? 1
  if (opacity < 1) attrs['Opacity'] = opacity.toFixed(2)

  // Font properties (check if mixed)
  const fontSize = typeof node.fontSize === 'number' ? node.fontSize : null
  const fontFamily = typeof node.fontName === 'object' && !('figma' in (node.fontName as object))
    ? (node.fontName as FontName).family
    : null
  const fontWeight = typeof node.fontName === 'object' && !('figma' in (node.fontName as object))
    ? mapFontWeight((node.fontName as FontName).style)
    : null
  const fontStyle = typeof node.fontName === 'object' && !('figma' in (node.fontName as object))
    ? mapFontStyle((node.fontName as FontName).style)
    : null

  if (fontSize) attrs['FontSize'] = fontSize.toFixed(0)
  if (fontFamily) attrs['FontFamily'] = fontFamily
  if (fontWeight && fontWeight !== 'Normal') attrs['FontWeight'] = fontWeight
  if (fontStyle && fontStyle !== 'Normal') attrs['FontStyle'] = fontStyle

  // Text alignment
  const textAlign = mapTextAlign(node.textAlignHorizontal)
  if (textAlign !== 'Left') attrs['TextAlignment'] = textAlign

  // Text wrapping
  if (node.textAutoResize === 'HEIGHT') {
    attrs['TextWrapping'] = 'Wrap'
  }

  // Foreground color (top fill)
  const fills = node.fills as Paint[]
  const solidFill = [...fills].reverse().find(f => f.visible !== false && f.type === 'SOLID') as SolidPaint | undefined
  if (solidFill) {
    const color = figmaColorToXaml(solidFill.color, solidFill.opacity ?? 1)
    attrs['Foreground'] = color
  }

  // Effects
  const effectProp = convertEffects(node.effects ?? [])
  if (effectProp) propElements.push(effectProp)

  // Text content — detect bindings
  const text = node.characters
  const result = makeNode('TextBlock', attrs)
  result.propertyElements = propElements

  if (containsBinding(text)) {
    // Mixed content: may have literal + binding parts
    const inlines = buildInlines(text)
    if (inlines.length === 1 && inlines[0].tag === '_binding') {
      // Pure binding → use Text attribute
      attrs['Text'] = inlines[0].content!
    } else {
      // Mixed → TextBlock.Inlines with Run elements
      const runNodes = inlines.map(inline => {
        if (inline.tag === '_binding') {
          return makeNode('Run', { Text: inline.content! })
        } else {
          const run = makeNode('Run', {})
          run.content = inline.content
          return run
        }
      })
      result.propertyElements = [
        ...(propElements),
        { property: 'TextBlock.Inlines', children: runNodes },
      ]
      return result
    }
  } else {
    // Plain text
    result.content = text
  }

  return result
}

/**
 * Split text into segments: literal strings and {Binding ...} / {StaticResource ...} expressions.
 */
function buildInlines(text: string): Array<{ tag: string; content: string }> {
  const parts: Array<{ tag: string; content: string }> = []
  const regex = /(\{[^}]+\})/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ tag: '_literal', content: text.slice(last, match.index) })
    }
    parts.push({ tag: '_binding', content: match[1] })
    last = match.index + match[0].length
  }
  if (last < text.length) {
    parts.push({ tag: '_literal', content: text.slice(last) })
  }
  return parts
}

function containsBinding(text: string): boolean {
  return /\{[A-Za-z]/.test(text)
}

function mapFontWeight(style: string): string {
  if (/thin/i.test(style)) return 'Thin'
  if (/extra\s?light/i.test(style)) return 'ExtraLight'
  if (/light/i.test(style)) return 'Light'
  if (/medium/i.test(style)) return 'Medium'
  if (/semi\s?bold/i.test(style)) return 'SemiBold'
  if (/extra\s?bold/i.test(style)) return 'ExtraBold'
  if (/bold/i.test(style)) return 'Bold'
  if (/black|heavy/i.test(style)) return 'Black'
  return 'Normal'
}

function mapFontStyle(style: string): string {
  if (/italic/i.test(style)) return 'Italic'
  if (/oblique/i.test(style)) return 'Oblique'
  return 'Normal'
}

function mapTextAlign(align: string): string {
  switch (align) {
    case 'LEFT': return 'Left'
    case 'CENTER': return 'Center'
    case 'RIGHT': return 'Right'
    case 'JUSTIFIED': return 'Justify'
    default: return 'Left'
  }
}
