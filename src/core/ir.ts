// Intermediate Representation — a neutral XAML node tree
// produced by mappers, consumed by the XAML emitter

export interface XamlNode {
  tag: string
  name?: string                        // x:Name value
  attributes: Record<string, string>   // simple key="value" attrs
  children: XamlNode[]
  content?: string                     // inline text content (e.g. TextBlock text)
  selfClosing?: boolean
  comment?: string                     // XML comment placed before this node
  // Complex child elements (e.g. Property.Element syntax):
  propertyElements?: PropertyElement[]
  // Image data to export (keyed by asset filename)
  imageExports?: ImageExport[]
}

// For XAML property element syntax: <Button.Background><LinearGradientBrush .../>
export interface PropertyElement {
  property: string   // e.g. "Button.Background"
  children: XamlNode[]
}

export interface ImageExport {
  filename: string
  nodeId: string
  format: 'PNG' | 'SVG'
  scale: number
  imageHash?: string   // set for image fills — use getImageByHash instead of exportAsync
}

export function makeNode(tag: string, attrs: Record<string, string> = {}, children: XamlNode[] = []): XamlNode {
  return { tag, attributes: attrs, children }
}

export function setName(node: XamlNode, name: string | undefined): XamlNode {
  if (name) node.name = name
  return node
}
