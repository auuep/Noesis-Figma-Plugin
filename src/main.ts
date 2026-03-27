/// <reference types="@figma/plugin-typings" />
import { traverseNode, TraverseResult } from './core/traverser'
import { emitXaml, EmitOptions } from './core/xaml-emitter'
import { collectDocumentResources } from './core/resource-collector'
import { XamlNode, ImageExport } from './core/ir'
import { reviewLayerNames, NameReviewItem } from './core/name-reviewer'

// Show the plugin UI
figma.showUI(__html__, { width: 520, height: 640, title: 'NoesisGUI XAML Exporter' })

// --- Types for messages between main thread and UI ---

export interface GenerateMessage {
  type: 'generate'
  options: Partial<EmitOptions> & { includeResources?: boolean }
}

export interface ExportMessage {
  type: 'export'
  options: Partial<EmitOptions> & { includeResources?: boolean }
}

export interface ReviewNamesMessage {
  type: 'review-names'
}

export interface ApplyRenamesMessage {
  type: 'apply-renames'
}

interface NamesReviewedMessage {
  type: 'names-reviewed'
  items: NameReviewItem[]
  hasSelection: boolean
}

interface RenamesAppliedMessage {
  type: 'renames-applied'
  count: number
}

interface XamlReadyMessage {
  type: 'xaml-ready'
  xaml: string
  hasSelection: boolean
  nodeCount: number
  warnings: string[]
}

interface ExportReadyMessage {
  type: 'export-ready'
  files: Array<{ filename: string; content: string | Uint8Array }>
}

interface ImageDataMessage {
  type: 'image-data'
  nodeId: string
  filename: string
  data: Uint8Array
}

// --- State ---
let currentXaml = ''
let currentImageExports: ImageExport[] = []
let pendingRenames: Array<{ node: SceneNode; newName: string }> = []

// --- Generate XAML from current selection ---

async function generateFromSelection(options: GenerateMessage['options'] = {}): Promise<void> {
  const selection = figma.currentPage.selection
  const warnings: string[] = []

  if (selection.length === 0) {
    figma.ui.postMessage({
      type: 'xaml-ready',
      xaml: '',
      hasSelection: false,
      nodeCount: 0,
      warnings: [],
    } as XamlReadyMessage)
    return
  }

  const allImageExports: ImageExport[] = []
  let rootNode: XamlNode

  if (selection.length === 1) {
    const result = traverseNode(selection[0])
    if (!result) {
      figma.ui.postMessage({
        type: 'xaml-ready',
        xaml: '<!-- Could not convert the selected node -->',
        hasSelection: true,
        nodeCount: 0,
        warnings: ['Selected node could not be converted'],
      } as XamlReadyMessage)
      return
    }
    rootNode = result.node
    allImageExports.push(...result.imageExports)
  } else {
    // Multiple selection → wrap in a Canvas
    const children: XamlNode[] = []
    for (const node of selection) {
      const result = traverseNode(node)
      if (result) {
        children.push(result.node)
        allImageExports.push(...result.imageExports)
      }
    }
    rootNode = { tag: 'Canvas', attributes: {}, children }
  }

  // Optionally prepend resources
  if (options.includeResources) {
    const resources = collectDocumentResources()
    if (resources) {
      const resourcesProp = {
        property: `${rootNode.tag}.Resources`,
        children: [resources],
      }
      rootNode.propertyElements = rootNode.propertyElements ?? []
      rootNode.propertyElements.unshift(resourcesProp)
    }
  }

  currentXaml = emitXaml(rootNode, options)
  currentImageExports = allImageExports

  const nodeCount = countNodes(rootNode)
  figma.ui.postMessage({
    type: 'xaml-ready',
    xaml: currentXaml,
    hasSelection: true,
    nodeCount,
    warnings,
  } as XamlReadyMessage)
}

// --- Handle export: send image data to UI for zipping ---

async function handleExport(options: ExportMessage['options']): Promise<void> {
  await generateFromSelection(options)

  const files: Array<{ filename: string; content: string | number[] }> = []

  // Main XAML file
  files.push({ filename: 'ui.xaml', content: currentXaml })

  // Export images
  for (const imgExport of currentImageExports) {
    try {
      let bytes: Uint8Array

      if (imgExport.imageHash) {
        // Image fill — fetch raw image bytes directly from the fill hash
        const image = figma.getImageByHash(imgExport.imageHash)
        if (!image) {
          console.warn(`Image not found for hash ${imgExport.imageHash}`)
          continue
        }
        bytes = await image.getBytesAsync()
      } else {
        // Complex shape / vector — render the node as PNG
        const node = figma.getNodeById(imgExport.nodeId) as SceneNode
        if (!node) continue
        bytes = await (node as ExportMixin).exportAsync({
          format: imgExport.format,
          constraint: { type: 'SCALE', value: imgExport.scale },
        })
      }

      files.push({ filename: imgExport.filename, content: Array.from(bytes) })
    } catch (e) {
      console.error(`Failed to export ${imgExport.filename}:`, e)
    }
  }

  figma.ui.postMessage({ type: 'export-ready', files } as ExportReadyMessage)
}

// --- Listen for messages from UI ---

figma.ui.onmessage = async (msg: GenerateMessage | ExportMessage | ReviewNamesMessage | ApplyRenamesMessage) => {
  switch (msg.type) {
    case 'generate':
      await generateFromSelection(msg.options)
      break
    case 'export':
      await handleExport(msg.options)
      break
    case 'review-names':
      handleReviewNames()
      break
    case 'apply-renames':
      handleApplyRenames()
      break
  }
}

function handleReviewNames(): void {
  const selection = figma.currentPage.selection
  if (selection.length === 0) {
    pendingRenames = []
    figma.ui.postMessage({
      type: 'names-reviewed',
      items: [],
      hasSelection: false,
    } as NamesReviewedMessage)
    return
  }

  const items = reviewLayerNames(selection)

  // Keep live node references on the main thread — avoids ID round-trip through the UI
  const nodeMap = new Map<string, SceneNode>()
  function indexNodes(node: SceneNode): void {
    nodeMap.set(node.id, node)
    if ('children' in node) {
      for (const child of (node as ChildrenMixin).children) indexNodes(child as SceneNode)
    }
  }
  for (const node of selection) indexNodes(node)

  pendingRenames = items.map(item => ({
    node: nodeMap.get(item.nodeId)!,
    newName: item.suggestedName,
  }))

  figma.ui.postMessage({
    type: 'names-reviewed',
    items,
    hasSelection: true,
  } as NamesReviewedMessage)
}

function handleApplyRenames(): void {
  let count = 0
  for (const { node, newName } of pendingRenames) {
    try {
      node.name = newName
      count++
    } catch (e) {
      console.warn(`Could not rename node "${node.name}":`, e)
    }
  }
  pendingRenames = []
  figma.ui.postMessage({ type: 'renames-applied', count } as RenamesAppliedMessage)
}

// --- Auto-generate on selection change ---

figma.on('selectionchange', () => {
  generateFromSelection()
})

// --- Initial generate on open ---
generateFromSelection()

// --- Utilities ---

function countNodes(node: XamlNode): number {
  return 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0)
}
