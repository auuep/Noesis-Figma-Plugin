import { XamlNode, ImageExport, makeNode } from '../core/ir'

/**
 * Build an Image element for a node that is purely an image (exported as PNG).
 */
export function makeImageElement(
  nodeId: string,
  nodeName: string,
  width: number,
  height: number,
): { node: XamlNode; export: ImageExport } {
  const filename = `Assets/${sanitizeFilename(nodeName)}.png`
  const node = makeNode('Image', {
    Source: filename,
    Width: width.toFixed(0),
    Height: height.toFixed(0),
    Stretch: 'Uniform',
  })
  node.selfClosing = true

  return {
    node,
    export: { filename, nodeId, format: 'PNG', scale: 2 },
  }
}

function sanitizeFilename(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64) || 'image'
}
