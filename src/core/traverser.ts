import { XamlNode, ImageExport, makeNode } from './ir'
import { parseLayerName, parseDescription } from '../mappers/name-parser'
import { lookupTag } from '../utils/tags'
import { resolveLayout, computeChildMargin, mapAlignment, formatThickness } from '../mappers/layout'
import { convertRectangle, convertEllipse } from '../mappers/shape'
import { convertText } from '../mappers/text'
import { convertFills, convertStrokes, makeBrushPropertyElement } from '../mappers/fills'
import { convertEffects } from '../mappers/effects'
import { applyDescriptionProps, getChildLayoutProps, wrapControlContent } from '../mappers/controls'
import { makeImageElement } from '../mappers/image'
import { sanitizeName } from '../utils/naming'

export interface TraverseResult {
  node: XamlNode
  imageExports: ImageExport[]
}

/**
 * Convert a Figma SceneNode (and its descendants) into an IR XamlNode tree.
 */
export function traverseNode(
  node: SceneNode,
  parentHasAutoLayout: boolean = false,
  parentIsCanvas: boolean = false,
  childIndex: number = 0,
  totalSiblings: number = 1,
  parentNode?: FrameNode,
): TraverseResult | null {
  const allImageExports: ImageExport[] = []

  const parsed = parseLayerName(node.name)

  // Skip node
  if (parsed.isSkipped) return null

  // Comment node
  if (parsed.isComment) {
    const commentNode = makeNode('!--', {})
    commentNode.comment = parsed.commentText
    commentNode.selfClosing = true
    // We'll handle this specially in the emitter — for now return a dummy placeholder
    const n: XamlNode = { tag: '__comment__', attributes: {}, children: [], comment: parsed.commentText }
    return { node: n, imageExports: [] }
  }

  // Get description properties
  const desc = 'description' in node ? (node as any).description as string : undefined
  const descProps = parseDescription(desc)

  // Determine layout attached props (Grid.Row, Dock, etc.)
  const childLayoutAttrs = getChildLayoutProps(descProps)

  let result: XamlNode

  switch (node.type) {
    case 'TEXT':
      result = convertText(node)
      break

    case 'RECTANGLE': {
      const { node: shapeNode, imageExports } = convertRectangle(node)
      allImageExports.push(...(imageExports ?? []).map(e => ({ ...e, format: 'PNG' as const, scale: 2 })))
      result = shapeNode
      break
    }

    case 'ELLIPSE': {
      const { node: shapeNode, imageExports } = convertEllipse(node)
      allImageExports.push(...(imageExports ?? []).map(e => ({ ...e, format: 'PNG' as const, scale: 2 })))
      result = shapeNode
      break
    }

    case 'VECTOR':
    case 'STAR':
    case 'POLYGON':
    case 'LINE': {
      // Export as image
      const { node: imgNode, export: imgExport } = makeImageElement(node.id, node.name, node.width, node.height)
      allImageExports.push(imgExport)
      result = imgNode
      break
    }

    case 'FRAME':
    case 'GROUP':
    case 'COMPONENT':
    case 'INSTANCE': {
      result = traverseContainer(
        node as FrameNode,
        parsed.tagInfo?.tag,
        descProps,
        allImageExports,
        parentHasAutoLayout,
      )
      break
    }

    default:
      // Unsupported node type — skip
      return null
  }

  // Apply x:Name
  if (parsed.name && !result.name) {
    result.name = parsed.name
  }

  // Apply description props as XAML attributes
  applyDescriptionProps(result.attributes, descProps)

  // Apply child layout attrs (Grid.Row, Dock, etc.)
  Object.assign(result.attributes, childLayoutAttrs)

  // Apply child margin from parent auto-layout spacing
  if (parentHasAutoLayout && parentNode && 'itemSpacing' in parentNode) {
    const isFirst = childIndex === 0
    const isLast = childIndex === totalSiblings - 1
    const margin = computeChildMargin(parentNode, isFirst, isLast)
    if (margin) result.attributes['Margin'] = result.attributes['Margin'] ?? margin
  }

  // Alignment from constraints (when parent is not auto-layout)
  if (!parentHasAutoLayout) {
    const alignAttrs = mapAlignment(node, false)
    Object.assign(result.attributes, alignAttrs)
  }

  // Rotation via RenderTransform
  if ('rotation' in node && node.rotation && Math.abs(node.rotation) > 0.01) {
    const deg = (-node.rotation).toFixed(2) // Figma rotation is CCW, XAML is CW
    result.attributes['RenderTransformOrigin'] = '0.5,0.5'
    result.propertyElements = result.propertyElements ?? []
    result.propertyElements.push({
      property: 'UIElement.RenderTransform',
      children: [makeNode('RotateTransform', { Angle: deg })]
    })
  }

  return { node: result, imageExports: allImageExports }
}

function traverseContainer(
  node: FrameNode | GroupNode | ComponentNode | InstanceNode,
  forcedTag: string | undefined,
  descProps: ReturnType<typeof parseDescription>,
  allImageExports: ImageExport[],
  parentHasAutoLayout: boolean,
): XamlNode {
  const hasAutoLayout = 'layoutMode' in node && (node.layoutMode === 'VERTICAL' || node.layoutMode === 'HORIZONTAL')
  const layoutResult = resolveLayout(node, forcedTag, descProps)

  const containerAttrs: Record<string, string> = { ...layoutResult.attributes }
  const propElements = []
  const definitionNodes: XamlNode[] = layoutResult.gridDefinitionNodes ?? []

  // Background fill for frames
  if ('fills' in node && (node as FrameNode).fills && (node as FrameNode).fills.length > 0) {
    const fills = (node as FrameNode).fills as Paint[]
    const fillResult = convertFills(fills as ReadonlyArray<Paint>, node.id, node.name, node.opacity ?? 1)
    if (fillResult) {
      if (fillResult.isImageFill) {
        allImageExports.push({ filename: fillResult.imageFilename!, nodeId: node.id, format: 'PNG', scale: 2, imageHash: fillResult.imageHash })
        propElements.push(makeBrushPropertyElement(
          `${layoutResult.tag}.Background`,
          makeNode('ImageBrush', { ImageSource: fillResult.imageFilename!, Stretch: 'UniformToFill' })
        ))
      } else if (fillResult.brushNode) {
        propElements.push(makeBrushPropertyElement(`${layoutResult.tag}.Background`, fillResult.brushNode))
      } else if (fillResult.inlineValue) {
        containerAttrs['Background'] = fillResult.inlineValue
      }
    }
  }

  // Strokes → BorderBrush/BorderThickness (for Border, or as overlay for others)
  if ('strokes' in node && (node as FrameNode).strokes.length > 0) {
    const strokeWeight = ('strokeWeight' in node) ? (node.strokeWeight as number ?? 1) : 1
    const strokeResult = convertStrokes((node as FrameNode).strokes as ReadonlyArray<Paint>, strokeWeight, node.opacity ?? 1)
    if (strokeResult) {
      if (strokeResult.brushValue) containerAttrs['BorderBrush'] = strokeResult.brushValue
      if (strokeResult.thickness) containerAttrs['BorderThickness'] = strokeResult.thickness
    }
  }

  // Corner radius on frames
  if ('cornerRadius' in node && typeof (node as FrameNode).cornerRadius === 'number') {
    const cr = (node as FrameNode).cornerRadius as number
    if (cr > 0) containerAttrs['CornerRadius'] = cr.toFixed(0)
  }

  // Opacity
  if ((node.opacity ?? 1) < 1) containerAttrs['Opacity'] = (node.opacity!).toFixed(2)

  // Effects
  const effectProp = convertEffects(node.effects ?? [])
  if (effectProp) propElements.push(effectProp)

  // Traverse children
  const children: XamlNode[] = []
  if ('children' in node) {
    const visibleChildren = node.children.filter(c => c.visible !== false)
    visibleChildren.forEach((child, i) => {
      const childResult = traverseNode(
        child,
        hasAutoLayout,
        layoutResult.tag === 'Canvas',
        i,
        visibleChildren.length,
        hasAutoLayout ? node as FrameNode : undefined,
      )
      if (!childResult) return

      // Apply Canvas position attrs from layoutResult
      if (layoutResult.childAttrs?.has(i)) {
        Object.assign(childResult.node.attributes, layoutResult.childAttrs.get(i))
      }

      children.push(childResult.node)
      allImageExports.push(...childResult.imageExports)
    })
  }

  // For controls with special content rules, wrap children
  const tagInfo = lookupTag(layoutResult.tag)
  let finalChildren = children
  if (tagInfo && (tagInfo.category === 'control' || tagInfo.category === 'display')) {
    const wrapped = wrapControlContent(tagInfo, children)
    finalChildren = wrapped.children
  }

  const containerNode = makeNode(layoutResult.tag, containerAttrs, [
    ...definitionNodes,
    ...finalChildren,
  ])
  containerNode.propertyElements = propElements.length > 0 ? propElements : undefined
  return containerNode
}
