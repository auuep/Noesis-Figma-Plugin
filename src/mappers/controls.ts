import { XamlNode, makeNode } from '../core/ir'
import { lookupTag, TagInfo } from '../utils/tags'
import { DescriptionProps } from './name-parser'

/**
 * Apply description-field properties to a node's attribute map.
 * Filters out layout-only props that are handled elsewhere.
 */
const LAYOUT_ONLY_PROPS = new Set([
  'RowDefinitions', 'ColumnDefinitions',
  'Grid.Row', 'Grid.Column', 'Grid.RowSpan', 'Grid.ColumnSpan',
  'Dock',
  'ItemWidth', 'ItemHeight',
  'Rows', 'Columns',
])

export function applyDescriptionProps(
  attrs: Record<string, string>,
  descProps: DescriptionProps,
): void {
  for (const [key, value] of Object.entries(descProps)) {
    if (!LAYOUT_ONLY_PROPS.has(key)) {
      attrs[key] = value
    }
  }
}

/**
 * Get the attached layout properties for a child node
 * (Grid.Row, Grid.Column, Dock, etc.) from its description.
 */
export function getChildLayoutProps(descProps: DescriptionProps): Record<string, string> {
  const attrs: Record<string, string> = {}

  if (descProps['Grid.Row']) attrs['Grid.Row'] = descProps['Grid.Row']
  if (descProps['Grid.Column']) attrs['Grid.Column'] = descProps['Grid.Column']
  if (descProps['Grid.RowSpan']) attrs['Grid.RowSpan'] = descProps['Grid.RowSpan']
  if (descProps['Grid.ColumnSpan']) attrs['Grid.ColumnSpan'] = descProps['Grid.ColumnSpan']
  if (descProps['Dock']) attrs['DockPanel.Dock'] = descProps['Dock']

  return attrs
}

/**
 * Wrap a list of child XamlNodes inside a control's appropriate
 * content property when the tag requires it.
 *
 * e.g. Button with a single child frame → the child is the Button's Content
 *      (rendered as-is inside the Button tags)
 * e.g. ComboBox with text children → ComboBoxItem wrappers
 */
export function wrapControlContent(
  tagInfo: TagInfo,
  children: XamlNode[],
  textContent?: string,
): { children: XamlNode[]; contentAttr?: [string, string] } {
  switch (tagInfo.tag) {
    case 'ComboBox':
    case 'ListBox':
      return {
        children: children.map(c => {
          const item = makeNode(tagInfo.tag === 'ComboBox' ? 'ComboBoxItem' : 'ListBoxItem', {})
          item.children = [c]
          return item
        }),
      }

    case 'TabControl':
      return {
        children: children.map(c => {
          const tab = makeNode('TabItem', { Header: c.name ?? 'Tab' })
          tab.children = c.children
          return tab
        }),
      }

    case 'TextBox':
    case 'PasswordBox':
      // Content sets placeholder via comment; actual Text binding in descProps
      return { children: [] }

    default:
      // Button, ToggleButton, etc: inline content naturally
      return { children }
  }
}
