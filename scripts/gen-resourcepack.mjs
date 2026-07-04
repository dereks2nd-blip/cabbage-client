// Generates the Cabbage tennis-bird resource pack (custom title-screen panorama,
// splash texts, pack icon) into resources/resourcepack/. Run: npm run pack
import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packRoot = join(root, 'resources', 'resourcepack')
const bgDir = join(packRoot, 'assets', 'minecraft', 'textures', 'gui', 'title', 'background')
const textsDir = join(packRoot, 'assets', 'minecraft', 'texts')
// Modern MC (1.20.2+, incl. the 26.x line) draws GUI widgets from this sprite
// folder — retexturing here restyles buttons with NO mappings needed, so the
// custom look reaches versions the Java mod can't (26.x has no mappings).
const widgetDir = join(packRoot, 'assets', 'minecraft', 'textures', 'gui', 'sprites', 'widget')
mkdirSync(bgDir, { recursive: true })
mkdirSync(textsDir, { recursive: true })
mkdirSync(widgetDir, { recursive: true })

// A small fuzzy tennis bird, reused across panorama faces.
function bird(cx, cy, s) {
  return `
    <g transform="translate(${cx} ${cy}) scale(${s})">
      <circle cx="0" cy="0" r="70" fill="#e3f24a"/>
      <circle cx="0" cy="0" r="70" fill="none" stroke="#bcd827" stroke-width="4"/>
      <path d="M-64 -40 C-30 -12 -30 24 -62 56" fill="none" stroke="#fbfdee" stroke-width="6" stroke-linecap="round"/>
      <path d="M64 -40 C30 -12 30 24 62 56" fill="none" stroke="#fbfdee" stroke-width="6" stroke-linecap="round"/>
      <ellipse cx="30" cy="-8" rx="9" ry="10" fill="#16160f"/>
      <path d="M56 0 L92 8 L56 20 Q48 10 56 0 Z" fill="#d8ad4e" stroke="#a9842f" stroke-width="2"/>
    </g>`
}

function sideFace(seed) {
  const birds = [
    bird(260, 360, 1.1),
    bird(760, 620, 0.8),
    bird(520, 200, 0.55)
  ]
  // rotate which birds show per face so it feels varied
  const shown = birds.slice(0, 2 + (seed % 2))
  return `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#25402a"/><stop offset="55%" stop-color="#182c1c"/><stop offset="100%" stop-color="#0e1411"/>
    </linearGradient></defs>
    <rect width="1024" height="1024" fill="url(#sky)"/>
    <circle cx="${140 + seed * 120}" cy="140" r="46" fill="#e3f24a" opacity="0.5"/>
    ${shown.join('')}
    <rect x="0" y="980" width="1024" height="44" fill="#0a0f0c"/>
  </svg>`
}

function upFace() {
  return `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="up" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#2c4a2f"/><stop offset="100%" stop-color="#1b2f1f"/></radialGradient></defs>
    <rect width="1024" height="1024" fill="url(#up)"/>
    <circle cx="512" cy="512" r="120" fill="#e3f24a"/>
    <circle cx="512" cy="512" r="120" fill="none" stroke="#bcd827" stroke-width="6"/>
    <path d="M404 430 C470 500 470 560 400 630" fill="none" stroke="#fbfdee" stroke-width="8" stroke-linecap="round"/>
    <path d="M620 430 C554 500 554 560 624 630" fill="none" stroke="#fbfdee" stroke-width="8" stroke-linecap="round"/>
  </svg>`
}

function downFace() {
  return `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="1024" fill="#0a0f0c"/>
    <rect x="80" y="80" width="864" height="864" fill="none" stroke="#2a5a1e" stroke-width="8" opacity="0.5"/>
    <line x1="512" y1="80" x2="512" y2="944" stroke="#2a5a1e" stroke-width="6" opacity="0.5"/>
  </svg>`
}

const icon = `<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" rx="20" fill="#0e1411"/>
  ${bird(64, 66, 0.62)}
</svg>`

async function png(svg, out, size) {
  writeFileSync(out, await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer())
}

async function pngWH(svg, out, w, h) {
  writeFileSync(out, await sharp(Buffer.from(svg)).resize(w, h).png().toBuffer())
}

// --- Cabbage-skinned button sprites (200x20, nine-slice border 3) ---
// The outer 3px is the fixed nine-slice frame; the interior stretches. Keep all
// border decoration inside that 3px band so buttons stay crisp at any width.
function button({ frame, interior, bevel }) {
  return `<svg width="200" height="20" xmlns="http://www.w3.org/2000/svg">
    <rect width="200" height="20" fill="#0a0f0c"/>
    <rect x="1" y="1" width="198" height="18" fill="${frame}"/>
    <rect x="3" y="3" width="194" height="14" fill="${interior}"/>
    ${bevel ? `<rect x="3" y="3" width="194" height="2" fill="${bevel}"/>` : ''}
  </svg>`
}

const BUTTONS = {
  'button.png': button({ frame: '#63b330', interior: '#182c16', bevel: '#2f5222' }),
  'button_highlighted.png': button({ frame: '#9be84a', interior: '#223d1b', bevel: '#3f6a2c' }),
  'button_disabled.png': button({ frame: '#4a4d47', interior: '#131612', bevel: null })
}

// One nine-slice mcmeta shared by all three states (matches vanilla button dims).
const BUTTON_MCMETA = JSON.stringify(
  { gui: { scaling: { type: 'nine_slice', width: 200, height: 20, border: 3 } } },
  null,
  2
)

for (let i = 0; i < 4; i++) await png(sideFace(i), join(bgDir, `panorama_${i}.png`), 1024)
await png(upFace(), join(bgDir, 'panorama_4.png'), 1024)
await png(downFace(), join(bgDir, 'panorama_5.png'), 1024)
await png(icon, join(packRoot, 'pack.png'), 128)

for (const [name, svg] of Object.entries(BUTTONS)) {
  await pngWH(svg, join(widgetDir, name), 200, 20)
  writeFileSync(join(widgetDir, `${name}.mcmeta`), BUTTON_MCMETA)
}

writeFileSync(
  join(packRoot, 'pack.mcmeta'),
  JSON.stringify(
    {
      pack: {
        pack_format: 88,
        description: '§aCabbage Client §7— tennis bird theme'
      }
    },
    null,
    2
  )
)

writeFileSync(
  join(textsDir, 'splashes.txt'),
  [
    'Now with 100% more tennis birds!',
    'Fuzzy and fast!',
    'Serving aces since 2026!',
    'Bird? Ball? Both!',
    'Powered by cabbage!',
    'Deuce!',
    'New balls, please!',
    'Feather who?',
    'Optimized for frames AND feathers!',
    'Fifteen-love!',
    'The fuzziest client around',
    'Ace of the server list',
    'Chirp chirp, bounce bounce'
  ].join('\n')
)

console.log(
  'Wrote resource pack to resources/resourcepack/ (6 panorama faces, icon, splashes, 3 button sprites)'
)
