/**
 * Generates the Cabbage Client title-screen background for the HUD mod:
 * a Dawn-style flat pixel-art dusk scene — blocky terrain + trees, floating
 * island chunks in the top corners, cabbages, and googly tennis birds.
 *
 * Drawn at 240x135 logical pixels, upscaled 4x nearest-neighbor to 960x540.
 * Output: mod/src/main/resources/assets/cabbage-hud/textures/gui/title_background.png
 *
 * Run: npm run titlebg
 */
import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(root, 'mod', 'src', 'main', 'resources', 'assets', 'cabbage-hud', 'textures', 'gui', 'title_background.png')

const W = 240
const H = 135
const px = new Uint8Array(W * H * 4)

// deterministic PRNG so the art is reproducible
let seed = 0xcabba6e
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

function hex(c) {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255]
}

function set(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return
  const i = (y * W + x) * 4
  const [r, g, b] = hex(c)
  px[i] = r
  px[i + 1] = g
  px[i + 2] = b
  px[i + 3] = 255
}

function rect(x, y, w, h, c) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, c)
}

/** Filled circle. */
function disc(cx, cy, r, c) {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) set(cx + x, cy + y, c)
}

/** 2x2-ordered dither blend between two colors, t in [0,1]. */
function dither(x, y, c1, c2, t) {
  const m = [0.2, 0.7, 0.95, 0.45][(y % 2) * 2 + (x % 2)]
  set(x, y, t > m ? c2 : c1)
}

// ---------- sky (dusk gradient, dithered bands) ----------
const SKY = [0x0d1a14, 0x14261b, 0x1c3421, 0x274527, 0x35582c, 0x476b31, 0x5d8038]
for (let y = 0; y < H; y++) {
  const f = (y / H) * (SKY.length - 1)
  const i = Math.min(SKY.length - 2, Math.floor(f))
  for (let x = 0; x < W; x++) dither(x, y, SKY[i], SKY[i + 1], f - i)
}

// ---------- sun: pale diamond with rays, low over the horizon ----------
const sunX = 120
const sunY = 46
for (let y = -9; y <= 9; y++)
  for (let x = -9; x <= 9; x++) {
    const d = Math.abs(x) + Math.abs(y)
    if (d <= 6) set(sunX + x, sunY + y, 0xf2f8b8)
    else if (d <= 9) dither(sunX + x, sunY + y, 0xf2f8b8, 0xb8d072, 0.55)
  }
rect(sunX - 1, sunY - 15, 2, 4, 0xe8f0a4) // rays
rect(sunX - 14, sunY - 1, 4, 2, 0xe8f0a4)
rect(sunX + 10, sunY - 1, 4, 2, 0xe8f0a4)
rect(sunX - 11, sunY - 11, 2, 2, 0xe8f0a4)
rect(sunX + 9, sunY - 11, 2, 2, 0xe8f0a4)

// ---------- thin cloud strips ----------
for (const [cx, cy, cw] of [[26, 20, 34], [150, 14, 28], [190, 34, 30], [58, 38, 22]]) {
  rect(cx, cy, cw, 2, 0x2a4429)
  rect(cx + 4, cy + 2, cw - 10, 2, 0x223a23)
}

// ---------- distant tree-line silhouette ----------
for (let x = 0; x < W; x++) {
  const h = 6 + Math.floor(4 * Math.sin(x / 9) + 3 * Math.sin(x / 23) + rnd() * 2)
  for (let y = 96 - h; y < 96; y++) dither(x, y, 0x142216, 0x1b2c1b, 0.4)
}

// ---------- terrain: 12px block grid with two hill levels ----------
const BLOCK = 12
const HEIGHTS = [4, 4, 5, 5, 4, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 5, 6, 6, 5, 5] // blocks tall per column
function groundTop(x) {
  const bi = Math.max(0, Math.min(HEIGHTS.length - 1, Math.floor(x / BLOCK)))
  return H - HEIGHTS[bi] * BLOCK
}

const GRASS_LIP = 0x63b545
const GRASS = 0x4a8f34
const DIRTS = [0x4f3a26, 0x453222, 0x5a4430]
function drawGroundColumn(x, top, bottom) {
  for (let y = top; y < bottom; y++) {
    const d = y - top
    if (d < 3) set(x, y, GRASS_LIP)
    else if (d < 7) set(x, y, GRASS)
    else {
      // dirt with per-block shading + faint seams on the block grid
      const bi = Math.floor(x / BLOCK) * 31 + Math.floor(y / BLOCK) * 17
      let c = DIRTS[bi % 3]
      if (x % BLOCK === 0 || y % BLOCK === 0) c = 0x3a2b1c
      set(x, y, c)
    }
  }
}
for (let x = 0; x < W; x++) drawGroundColumn(x, groundTop(x), H)

// ---------- floating island chunks (top corners, Dawn-style) ----------
function floatingChunk(x0, w, yTop, depth) {
  for (let x = x0; x < x0 + w; x++) {
    // ragged underside
    const d = depth + Math.floor(3 * Math.sin(x / 5) + rnd() * 3)
    for (let y = yTop; y < yTop + d; y++) {
      const dd = y - yTop
      if (yTop > 0 && dd < 3) set(x, y, GRASS_LIP)
      else if (yTop > 0 && dd < 6) set(x, y, GRASS)
      else set(x, y, DIRTS[(x * 7 + y * 13) % 3])
    }
    // grass hanging on the bottom edge (it's the ceiling of the world)
    if (yTop === 0) {
      set(x, yTop + depth - 1 + Math.floor(2 * Math.sin(x / 5)), 0x3a6b28)
    }
  }
}
floatingChunk(0, 46, 0, 20)
floatingChunk(196, 44, 0, 24)
floatingChunk(210, 30, 40, 8) // small drifting shelf on the right

// ---------- blocky oak trees ----------
function tree(bx, baseY, trunkH, canopyW) {
  const TRUNK = 0x5a3f26
  const TRUNK_D = 0x46311d
  rect(bx, baseY - trunkH, 5, trunkH, TRUNK)
  rect(bx, baseY - trunkH, 2, trunkH, TRUNK_D)
  const L = [0x2f5a23, 0x3f7a2e, 0x234418]
  const cy = baseY - trunkH
  for (const [ox, oy, w, h] of [
    [-Math.floor(canopyW / 2) + 2, -10, canopyW, 11],
    [-Math.floor(canopyW / 2) + 6, -19, canopyW - 8, 10],
    [-Math.floor(canopyW / 4) + 3, -26, Math.floor(canopyW / 2), 8]
  ]) {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const c = L[(x * 3 + y * 5 + ((x + y) % 2)) % 3]
        set(bx + ox + x, cy + oy + y, c)
      }
  }
}
tree(26, groundTop(26), 22, 26)
tree(84, groundTop(84), 16, 22)
tree(168, groundTop(168), 26, 30)
tree(220, groundTop(220), 14, 18)

// ---------- cabbages ----------
function cabbage(cx, groundY, r) {
  const cy = groundY - r + 1
  disc(cx, cy, r, 0x2e6b26) // outer leaves
  disc(cx, cy, r - 2, 0x57a63d) // body
  // leaf veins: two light crescents + a bright core
  for (let a = -2; a <= 2; a++) {
    set(cx + a, cy - Math.floor(r / 2), 0x8bd45e)
    set(cx - Math.floor(r / 2), cy + a, 0x8bd45e)
  }
  disc(cx + 1, cy - 1, Math.max(1, r - 4), 0x8bd45e)
  disc(cx + 1, cy - 2, Math.max(1, r - 6), 0xb9ec86)
  // wrapper leaf flicks
  set(cx - r + 1, cy - 2, 0x8bd45e)
  set(cx + r - 1, cy - 1, 0x2e6b26)
}
cabbage(56, groundTop(56), 7)
cabbage(66, groundTop(66), 5)
cabbage(140, groundTop(140), 8)
cabbage(151, groundTop(151), 5)
cabbage(198, groundTop(198), 6)
cabbage(118, groundTop(118), 4)

// ---------- tennis birds (googly tennis-ball chicks) ----------
function bird(cx, groundY, r, { flying = false, flip = false } = {}) {
  const cy = flying ? groundY : groundY - r - 3
  // fuzzy tennis-ball body
  disc(cx, cy, r, 0xc9e34a)
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++)
      if (x * x + y * y <= r * r && (x + y * 2 + r) % 3 === 0) set(cx + x, cy + y, 0xa7bd35)
  // tennis-ball seam
  for (let x = -r + 1; x <= r - 1; x++) {
    const y = Math.round(Math.sin((x / r) * 1.9) * (r / 2.2))
    set(cx + x, cy + y, 0xe9f6d2)
  }
  // googly eyes (deliberately mismatched)
  const s = flip ? -1 : 1
  rect(cx - s * 3 - 1, cy - 3, 3, 3, 0xf5f9ee)
  set(cx - s * 3, cy - 2, 0x131a10)
  rect(cx + s * 1, cy - 4, 4, 4, 0xf5f9ee)
  set(cx + s * 2 + (flip ? 0 : 1), cy - 2, 0x131a10)
  // beak
  set(cx + s * (r - 1), cy, 0xe08a2d)
  set(cx + s * r, cy, 0xe08a2d)
  set(cx + s * (r - 1), cy + 1, 0xc9741f)
  if (flying) {
    // little wing
    rect(cx - s * r, cy - 1, 3, 2, 0xa7bd35)
    rect(cx - s * (r + 2), cy - 3, 3, 2, 0xc9e34a)
  } else {
    // stick legs + feet
    rect(cx - 2, cy + r, 1, 3, 0xb5762a)
    rect(cx + 2, cy + r, 1, 3, 0xb5762a)
    rect(cx - 3, cy + r + 3, 3, 1, 0xb5762a)
    rect(cx + 1, cy + r + 3, 3, 1, 0xb5762a)
  }
}
bird(104, groundTop(104), 6)
bird(160, groundTop(160), 4, { flip: true })
bird(70, 58, 5, { flying: true })
bird(226, 52, 3, { flying: true, flip: true }) // perched-looking, near the right shelf

// ---------- grass tufts + tiny flowers ----------
for (let i = 0; i < 26; i++) {
  const x = Math.floor(rnd() * W)
  const y = groundTop(x)
  set(x, y - 1, GRASS_LIP)
  if (rnd() > 0.5) set(x, y - 2, GRASS)
}
for (const [fx, fc] of [[38, 0xd94f4f], [130, 0xe8d44f], [186, 0xd94f4f], [98, 0xe8d44f]]) {
  const y = groundTop(fx)
  set(fx, y - 2, fc)
  set(fx, y - 1, 0x3f7a2e)
}

// ---------- vignette (baked-in darkening so the menu text stays readable) ----------
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const dx = (x / W) * 2 - 1
    const dy = (y / H) * 2 - 1
    const v = Math.max(0, 1 - 0.42 * (dx * dx + dy * dy) - 0.18)
    const i = (y * W + x) * 4
    px[i] = Math.round(px[i] * (0.62 + 0.38 * v))
    px[i + 1] = Math.round(px[i + 1] * (0.62 + 0.38 * v))
    px[i + 2] = Math.round(px[i + 2] * (0.62 + 0.38 * v))
  }

mkdirSync(dirname(OUT), { recursive: true })
await sharp(px, { raw: { width: W, height: H, channels: 4 } })
  .resize(W * 4, H * 4, { kernel: 'nearest' })
  .png()
  .toFile(OUT)
console.log('wrote', OUT)

// ---------- 16x16 tennis-bird sprite (button hover marker / branding) ----------
const SPRITE = join(dirname(OUT), 'bird.png')
const S = 16
const sp = new Uint8Array(S * S * 4) // transparent by default

function sset(x, y, c) {
  if (x < 0 || y < 0 || x >= S || y >= S) return
  const i = (y * S + x) * 4
  const [r, g, b] = hex(c)
  sp[i] = r
  sp[i + 1] = g
  sp[i + 2] = b
  sp[i + 3] = 255
}
function srect(x, y, w, h, c) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) sset(xx, yy, c)
}
function sdisc(cx, cy, r, c) {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) sset(cx + x, cy + y, c)
}
// fuzzy tennis-ball body
sdisc(7, 8, 6, 0xc9e34a)
for (let y = 2; y <= 14; y++)
  for (let x = 1; x <= 13; x++) {
    const dx = x - 7
    const dy = y - 8
    if (dx * dx + dy * dy <= 36 && (x + y * 2) % 3 === 0) sset(x, y, 0xa7bd35)
  }
// seam
for (let x = 2; x <= 12; x++) sset(x, 8 + Math.round(Math.sin(((x - 7) / 6) * 1.9) * 2.6), 0xe9f6d2)
// googly eyes (mismatched)
srect(3, 4, 3, 3, 0xf5f9ee)
sset(4, 5, 0x131a10)
srect(8, 3, 4, 4, 0xf5f9ee)
sset(10, 5, 0x131a10)
// beak (facing right)
sset(13, 8, 0xe08a2d)
sset(14, 8, 0xe08a2d)
sset(13, 9, 0xc9741f)
// tiny legs
srect(5, 14, 1, 2, 0xb5762a)
srect(9, 14, 1, 2, 0xb5762a)

await sharp(sp, { raw: { width: S, height: S, channels: 4 } }).png().toFile(SPRITE)
console.log('wrote', SPRITE)
