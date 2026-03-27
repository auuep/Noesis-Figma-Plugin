import * as esbuild from 'esbuild'
import * as fs from 'fs'
import * as path from 'path'

const isWatch = process.argv.includes('--watch')

// Build main plugin code (runs in Figma sandbox)
async function buildMain() {
  const ctx = await esbuild.context({
    entryPoints: ['src/main.ts'],
    bundle: true,
    outfile: 'dist/main.js',
    platform: 'browser',
    target: 'es6',
    format: 'iife',
    minify: false,
  })
  if (isWatch) {
    await ctx.watch()
    console.log('Watching main.ts...')
  } else {
    await ctx.rebuild()
    await ctx.dispose()
  }
}

// Build UI: bundle ui.ts, then inline it into ui.html
async function buildUI() {
  const ctx = await esbuild.context({
    entryPoints: ['src/ui/ui.ts'],
    bundle: true,
    outfile: 'dist/ui-bundle.js',
    platform: 'browser',
    target: 'es2020',
    format: 'iife',
    minify: false,
  })

  if (isWatch) {
    await ctx.watch()
    // Also watch HTML and CSS
    fs.watch('src/ui', { recursive: true }, () => inlineUI())
    console.log('Watching ui...')
  } else {
    await ctx.rebuild()
    await ctx.dispose()
    inlineUI()
  }
}

function inlineUI() {
  const html = fs.readFileSync('src/ui/ui.html', 'utf8')
  const css = fs.readFileSync('src/ui/ui.css', 'utf8')
  const js = fs.readFileSync('dist/ui-bundle.js', 'utf8')

  const output = html
    .replace('/* INJECT_CSS */', css)
    .replace('// INJECT_JS', js)

  fs.mkdirSync('dist', { recursive: true })
  fs.writeFileSync('dist/ui.html', output)
  console.log('Built dist/ui.html')
}

await Promise.all([buildMain(), buildUI()])
