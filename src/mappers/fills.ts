import { XamlNode, PropertyElement, makeNode } from '../core/ir'
import { figmaColorToXaml, isTransparent } from '../utils/color'

export interface FillResult {
  // Inline attribute value (for simple solid fills)
  inlineValue?: string
  // Complex brush node (for gradients, image fills)
  brushNode?: XamlNode
  // True if there's an image fill that needs export
  isImageFill?: boolean
  imageNodeId?: string
  imageFilename?: string
  imageHash?: string   // Figma image hash for direct retrieval via getImageByHash
}

/**
 * Convert Figma fills array to a XAML brush.
 * Returns the topmost visible fill.
 */
export function convertFills(
  fills: readonly Paint[],
  nodeId: string,
  nodeNameHint: string,
  opacity: number = 1,
): FillResult | null {
  // Find the topmost visible fill
  const visible = [...fills].reverse().find(f => f.visible !== false)
  if (!visible) return null

  switch (visible.type) {
    case 'SOLID':
      return convertSolidFill(visible as SolidPaint, opacity)
    case 'GRADIENT_LINEAR':
      return convertLinearGradient(visible as GradientPaint, opacity)
    case 'GRADIENT_RADIAL':
      return convertRadialGradient(visible as GradientPaint, opacity)
    case 'IMAGE':
      return convertImageFill(visible as ImagePaint, nodeId, nodeNameHint)
    default:
      return null
  }
}

function convertSolidFill(paint: SolidPaint, opacity: number): FillResult {
  const color = figmaColorToXaml(paint.color, paint.opacity ?? 1 * opacity)
  return { inlineValue: color }
}

function convertLinearGradient(paint: GradientPaint, opacity: number): FillResult {
  const stops = paint.gradientStops.map(stop => {
    const color = figmaColorToXaml(stop.color, opacity)
    return makeNode('GradientStop', { Color: color, Offset: stop.position.toFixed(3) })
  })

  // Figma stores gradient handle positions as normalized 0..1 coords
  // For a simple linear gradient we approximate StartPoint/EndPoint
  const handles = paint.gradientHandlePositions
  const start = handles[0]
  const end = handles[1]

  const brushNode = makeNode('LinearGradientBrush', {
    StartPoint: `${start.x.toFixed(3)},${start.y.toFixed(3)}`,
    EndPoint: `${end.x.toFixed(3)},${end.y.toFixed(3)}`,
  }, stops)

  return { brushNode }
}

function convertRadialGradient(paint: GradientPaint, opacity: number): FillResult {
  const stops = paint.gradientStops.map(stop => {
    const color = figmaColorToXaml(stop.color, opacity)
    return makeNode('GradientStop', { Color: color, Offset: stop.position.toFixed(3) })
  })

  const brushNode = makeNode('RadialGradientBrush', {}, stops)
  return { brushNode }
}

function convertImageFill(paint: ImagePaint, nodeId: string, nodeNameHint: string): FillResult {
  const filename = `Assets/${sanitizeFilename(nodeNameHint)}.png`
  return {
    isImageFill: true,
    imageNodeId: nodeId,
    imageFilename: filename,
    imageHash: paint.imageHash ?? undefined,
  }
}

/**
 * Convert Figma strokes to XAML BorderBrush / Stroke attributes.
 */
export interface StrokeResult {
  brushValue?: string
  thickness?: string
}

export function convertStrokes(
  strokes: readonly Paint[],
  strokeWeight: number,
  opacity: number = 1,
): StrokeResult | null {
  const visible = [...strokes].reverse().find(s => s.visible !== false)
  if (!visible) return null

  if (visible.type !== 'SOLID') return null

  const paint = visible as SolidPaint
  const color = figmaColorToXaml(paint.color, paint.opacity ?? 1 * opacity)
  return {
    brushValue: color,
    thickness: strokeWeight.toString(),
  }
}

/**
 * Build a property element for a brush (LinearGradientBrush etc.) on a given property.
 */
export function makeBrushPropertyElement(property: string, brushNode: XamlNode): PropertyElement {
  return { property, children: [brushNode] }
}

function sanitizeFilename(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64) || 'image'
}
