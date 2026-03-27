// Sanitize Figma layer names into valid XAML x:Name identifiers

export function sanitizeName(name: string): string {
  // Remove leading/trailing whitespace
  let s = name.trim()

  // Replace spaces and hyphens with underscores
  s = s.replace(/[\s\-]/g, '_')

  // Remove characters that aren't alphanumeric or underscore
  s = s.replace(/[^a-zA-Z0-9_]/g, '')

  // Must start with a letter or underscore
  if (s && /^[0-9]/.test(s)) {
    s = '_' + s
  }

  return s || 'Element'
}

export function toPascalCase(name: string): string {
  return name
    .split(/[\s_\-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}
