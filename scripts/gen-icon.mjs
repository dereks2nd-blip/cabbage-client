// Rasterizes build/icon.svg into the PNG + ICO assets electron-builder needs.
// Run with: npm run icon
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'build', 'icon.svg'))

// Master 512px PNG (electron-builder uses this for macOS/Linux and as a source).
const png512 = await sharp(svg).resize(512, 512).png().toBuffer()
writeFileSync(join(root, 'build', 'icon.png'), png512)

// Also emit resources/icon.png — imported by the main process as the runtime
// window/taskbar icon (works in dev, where electron-builder's icon isn't applied).
const { mkdirSync } = await import('fs')
mkdirSync(join(root, 'resources'), { recursive: true })
writeFileSync(join(root, 'resources', 'icon.png'), png512)

// Windows .ico bundles several sizes for crisp rendering everywhere.
const sizes = [16, 24, 32, 48, 64, 128, 256]
const pngs = await Promise.all(
  sizes.map((s) => sharp(svg).resize(s, s).png().toBuffer())
)
const ico = await pngToIco(pngs)
writeFileSync(join(root, 'build', 'icon.ico'), ico)

console.log('Wrote build/icon.png (512) and build/icon.ico (' + sizes.join(', ') + ')')
