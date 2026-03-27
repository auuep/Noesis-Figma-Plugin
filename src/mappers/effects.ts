import { XamlNode, PropertyElement, makeNode } from '../core/ir'
import { figmaColorToXaml } from '../utils/color'

/**
 * Convert Figma effects (drop shadow, inner shadow, blur) to XAML Effect property element.
 * NoesisGUI supports DropShadowEffect and BlurEffect.
 */
export function convertEffects(effects: readonly Effect[]): PropertyElement | null {
  const visible = effects.filter(e => e.visible !== false)
  if (visible.length === 0) return null

  // Use the first drop shadow
  const shadow = visible.find(e => e.type === 'DROP_SHADOW') as DropShadowEffect | undefined
  if (shadow) {
    const color = figmaColorToXaml(shadow.color)
    const effectNode = makeNode('DropShadowEffect', {
      Color: color,
      BlurRadius: shadow.radius.toString(),
      ShadowDepth: Math.sqrt(shadow.offset.x ** 2 + shadow.offset.y ** 2).toFixed(1),
      Direction: (Math.atan2(shadow.offset.y, shadow.offset.x) * 180 / Math.PI).toFixed(1),
      Opacity: (shadow.color.a).toFixed(2),
    })
    return { property: 'UIElement.Effect', children: [effectNode] }
  }

  // Use layer blur
  const blur = visible.find(e => e.type === 'LAYER_BLUR') as BlurEffect | undefined
  if (blur) {
    const effectNode = makeNode('BlurEffect', { Radius: blur.radius.toString() })
    return { property: 'UIElement.Effect', children: [effectNode] }
  }

  return null
}
