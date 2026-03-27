import { XamlNode, PropertyElement, makeNode } from '../core/ir'
import { convertFills, convertStrokes, makeBrushPropertyElement } from './fills'
import { convertEffects } from './effects'
import { FillResult } from './fills'

export interface ShapeResult {
  node: XamlNode
  imageExports?: Array<{ filename: string; nodeId: string }>
}

/**
 * Convert a Figma RECTANGLE node to a Border or Rectangle XAML element.
 * Use Border when there are children, Rectangle for pure shapes.
 */
export function convertRectangle(
  node: RectangleNode | FrameNode,
  useAsBorder: boolean = false,
): ShapeResult {
  const fills = ('fills' in node) ? node.fills as Paint[] : []
  const strokes = ('strokes' in node) ? node.strokes as Paint[] : []
  const opacity = node.opacity ?? 1

  const attrs: Record<string, string> = {}
  const propElements: PropertyElement[] = []
  const imageExports: Array<{ filename: string; nodeId: string }> = []

  // Size
  if ('width' in node) attrs['Width'] = (node.width).toFixed(0)
  if ('height' in node) attrs['Height'] = (node.height).toFixed(0)

  // Corner radius
  if ('cornerRadius' in node && typeof node.cornerRadius === 'number' && node.cornerRadius > 0) {
    attrs['CornerRadius'] = node.cornerRadius.toFixed(0)
  } else if ('topLeftRadius' in node) {
    const n = node as RectangleNode
    if (n.topLeftRadius || n.topRightRadius || n.bottomRightRadius || n.bottomLeftRadius) {
      attrs['CornerRadius'] = `${n.topLeftRadius},${n.topRightRadius},${n.bottomRightRadius},${n.bottomLeftRadius}`
    }
  }

  // Opacity
  if (opacity < 1) attrs['Opacity'] = opacity.toFixed(2)

  // Fill → Background
  const fillResult = fills.length > 0
    ? convertFills(fills as ReadonlyArray<Paint>, node.id, node.name, opacity)
    : null

  if (fillResult) {
    if (fillResult.isImageFill) {
      const filename = fillResult.imageFilename!
      const imgNode = makeNode('Image', { Source: filename, Stretch: 'UniformToFill' })
      imageExports.push({ filename, nodeId: node.id, imageHash: fillResult.imageHash })
      if (useAsBorder) {
        propElements.push({ property: 'Border.Background', children: [
          makeNode('ImageBrush', { ImageSource: filename, Stretch: 'UniformToFill' })
        ]})
      } else {
        return { node: imgNode, imageExports }
      }
    } else if (fillResult.brushNode) {
      const prop = useAsBorder ? 'Border.Background' : 'Rectangle.Fill'
      propElements.push(makeBrushPropertyElement(prop, fillResult.brushNode))
    } else if (fillResult.inlineValue) {
      attrs['Background'] = fillResult.inlineValue
    }
  }

  // Stroke → BorderBrush + BorderThickness (or Stroke + StrokeThickness for Rectangle)
  const strokeWeight = ('strokeWeight' in node) ? (node.strokeWeight as number) : 0
  const strokeResult = strokes.length > 0
    ? convertStrokes(strokes as ReadonlyArray<Paint>, strokeWeight, opacity)
    : null

  if (strokeResult) {
    if (useAsBorder) {
      if (strokeResult.brushValue) attrs['BorderBrush'] = strokeResult.brushValue
      if (strokeResult.thickness) attrs['BorderThickness'] = strokeResult.thickness
    } else {
      if (strokeResult.brushValue) attrs['Stroke'] = strokeResult.brushValue
      if (strokeResult.thickness) attrs['StrokeThickness'] = strokeResult.thickness
    }
  }

  // Effects
  const effectProp = convertEffects(node.effects ?? [])
  if (effectProp) propElements.push(effectProp)

  const tag = useAsBorder ? 'Border' : 'Rectangle'
  const result = makeNode(tag, attrs)
  result.propertyElements = propElements
  result.selfClosing = !useAsBorder
  return { node: result, imageExports }
}

/**
 * Convert a Figma ELLIPSE node.
 */
export function convertEllipse(node: EllipseNode): ShapeResult {
  const attrs: Record<string, string> = {}
  const propElements: PropertyElement[] = []
  const imageExports: Array<{ filename: string; nodeId: string }> = []

  attrs['Width'] = node.width.toFixed(0)
  attrs['Height'] = node.height.toFixed(0)

  const opacity = node.opacity ?? 1
  if (opacity < 1) attrs['Opacity'] = opacity.toFixed(2)

  const fillResult = node.fills.length > 0
    ? convertFills(node.fills as ReadonlyArray<Paint>, node.id, node.name, opacity)
    : null

  if (fillResult) {
    if (fillResult.isImageFill) {
      imageExports.push({ filename: fillResult.imageFilename!, nodeId: node.id, imageHash: fillResult.imageHash })
      propElements.push({ property: 'Ellipse.Fill', children: [
        makeNode('ImageBrush', { ImageSource: fillResult.imageFilename!, Stretch: 'UniformToFill' })
      ]})
    } else if (fillResult.brushNode) {
      propElements.push(makeBrushPropertyElement('Ellipse.Fill', fillResult.brushNode))
    } else if (fillResult.inlineValue) {
      attrs['Fill'] = fillResult.inlineValue
    }
  }

  const strokeWeight = node.strokeWeight as number
  const strokeResult = node.strokes.length > 0
    ? convertStrokes(node.strokes as ReadonlyArray<Paint>, strokeWeight, opacity)
    : null
  if (strokeResult) {
    if (strokeResult.brushValue) attrs['Stroke'] = strokeResult.brushValue
    if (strokeResult.thickness) attrs['StrokeThickness'] = strokeResult.thickness
  }

  const effectProp = convertEffects(node.effects ?? [])
  if (effectProp) propElements.push(effectProp)

  const result = makeNode('Ellipse', attrs)
  result.selfClosing = true
  result.propertyElements = propElements
  return { node: result, imageExports }
}
