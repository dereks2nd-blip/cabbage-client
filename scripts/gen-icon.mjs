// Rasterizes build/icon.svg into the PNG + ICO assets electron-builder needs.
// Run with: npm run icon
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'build', 'icon.svg'))

// Pixelated tennis bird: rasterize the SVG onto a coarse grid, then blow it up
// with nearest-neighbor so every cell stays a hard square (Minecraft-style).
const GRID = 24
const tiny = await sharp(svg).resize(GRID, GRID).png().toBuffer()
const pixelated = (size) =>
  sharp(tiny).resize(size, size, { kernel: 'nearest' }).png().toBuffer()

// Master 512px PNG (electron-builder uses this for macOS/Linux and as a source).
const png512 = await pixelated(512)
writeFileSync(join(root, 'build', 'icon.png'), png512)

// Also emit resources/icon.png — imported by the main process as the runtime
// window/taskbar icon (works in dev, where electron-builder's icon isn't applied).
const { mkdirSync } = await import('fs')
mkdirSync(join(root, 'resources'), { recursive: true })
writeFileSync(join(root, 'resources', 'icon.png'), png512)

// Windows .ico bundles several sizes for crisp rendering everywhere.
// Sizes at or below the grid get rendered straight from the SVG (a 16px icon
// can't show 24px pixels anyway); larger ones get the chunky upscale.
const sizes = [16, 24, 32, 48, 64, 128, 256]
const pngs = await Promise.all(
  sizes.map((s) => (s <= GRID ? sharp(svg).resize(s, s).png().toBuffer() : pixelated(s)))
)
const ico = await pngToIco(pngs)
writeFileSync(join(root, 'build', 'icon.ico'), ico)

console.log('Wrote build/icon.png (512) and build/icon.ico (' + sizes.join(', ') + ')')
