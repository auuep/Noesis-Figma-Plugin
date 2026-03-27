import { XamlNode, makeNode } from './ir'
import { figmaColorToXaml } from '../utils/color'
import { sanitizeName } from '../utils/naming'

export interface Resources {
  brushes: Map<string, string>   // x:Key → #AARRGGBB
  textStyles: Map<string, XamlNode>  // x:Key → Style node
}

/**
 * Extract Figma document-level color styles and text styles
 * into a ResourceDictionary node.
 */
export function collectDocumentResources(): XamlNode | null {
  const children: XamlNode[] = []

  // Color styles → SolidColorBrush resources
  try {
    const colorStyles = figma.getLocalPaintStyles()
    for (const style of colorStyles) {
      const fills = style.paints
      const solid = fills.find(f => f.type === 'SOLID') as SolidPaint | undefined
      if (!solid) continue

      const color = figmaColorToXaml(solid.color, solid.opacity ?? 1)
      const key = sanitizeName(style.name.replace(/\//g, '_'))
      const brush = makeNode('SolidColorBrush', { 'x:Key': key, Color: color })
      brush.selfClosing = true
      if (style.description) brush.comment = style.description
      children.push(brush)
    }
  } catch {
    // Not available in all contexts
  }

  // Text styles → Style resources
  try {
    const textStyles = figma.getLocalTextStyles()
    for (const style of textStyles) {
      const key = sanitizeName(style.name.replace(/\//g, '_'))
      const setters: XamlNode[] = []

      if (style.fontSize) {
        setters.push(makeSetter('FontSize', style.fontSize.toString()))
      }
      if (style.fontName) {
        setters.push(makeSetter('FontFamily', style.fontName.family))
        const weight = mapFontWeight(style.fontName.style)
        if (weight !== 'Normal') setters.push(makeSetter('FontWeight', weight))
        const fontStyle = mapFontStyle(style.fontName.style)
        if (fontStyle !== 'Normal') setters.push(makeSetter('FontStyle', fontStyle))
      }

      if (setters.length === 0) continue

      const styleNode = makeNode('Style', {
        'x:Key': key,
        TargetType: '{x:Type TextBlock}',
      }, setters)
      if (style.description) styleNode.comment = style.description
      children.push(styleNode)
    }
  } catch {
    // Not available in all contexts
  }

  if (children.length === 0) return null

  const dict = makeNode('ResourceDictionary', {}, children)
  return dict
}

function makeSetter(property: string, value: string): XamlNode {
  const n = makeNode('Setter', { Property: property, Value: value })
  n.selfClosing = true
  return n
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
  return 'Normal'
}
