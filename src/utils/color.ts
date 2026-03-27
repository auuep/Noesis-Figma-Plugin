// Convert Figma's float RGBA to XAML #AARRGGBB hex string

export function figmaColorToXaml(color: RGB | RGBA, opacity?: number): string {
  const r = Math.round(color.r * 255)
  const g = Math.round(color.g * 255)
  const b = Math.round(color.b * 255)

  let a = 255
  if ('a' in color) {
    a = Math.round(color.a * 255)
  }
  if (opacity !== undefined) {
    a = Math.round(a * opacity)
  }

  return `#${hex(a)}${hex(r)}${hex(g)}${hex(b)}`
}

function hex(n: number): string {
  return n.toString(16).padStart(2, '0').toUpperCase()
}

export function isTransparent(color: RGBA, opacity?: number): boolean {
  const effectiveAlpha = color.a * (opacity ?? 1)
  return effectiveAlpha < 0.01
}
