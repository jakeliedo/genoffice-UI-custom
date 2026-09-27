/**
 * Regenerates apps/shell/build/icon.png (1024x1024) and icon.ico (multi-size)
 * from the pastel-gradient mark in genoffice-logo.svg (the square icon,
 * without the "GenOffice" wordmark), using the same PNG-entry ICO container
 * approach as tools/gen-file-association-icons.mjs.
 *
 * Regenerate after changing the mark in
 * apps/shell/src/renderer/src/assets/genoffice-logo.svg:
 *   node tools/gen-app-icon.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'apps/shell/build')

// The icon mark (240x240) from genoffice-logo.svg, without the wordmark —
// an app icon is the square mark alone.
const MARK_SVG = `<svg width="240" height="240" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0)">
<rect width="240" height="240" rx="54" fill="url(#g)"/>
<rect x="51" y="46" width="90" height="108" rx="16" fill="white"/>
<rect x="99" y="86" width="90" height="108" rx="16" fill="white"/>
<path d="M99 102C99 93.1634 106.163 86 115 86H141V138C141 146.837 133.837 154 125 154H99V102Z" fill="url(#g)"/>
</g>
<defs>
<clipPath id="clip0"><rect width="240" height="240" fill="white"/></clipPath>
<linearGradient id="g" x1="0" y1="0" x2="240" y2="240" gradientUnits="userSpaceOnUse">
<stop offset="0%" stop-color="#8ab4e8"/>
<stop offset="50%" stop-color="#e6a9c7"/>
<stop offset="100%" stop-color="#e0af2e"/>
</linearGradient>
</defs>
</svg>`

const WIN_SIZES = [16, 24, 32, 48, 64, 128, 256]
const PNG_SIZE = 1024

/** ICO container with PNG-compressed entries (supported since Vista). */
function buildIco(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)
  const dir = Buffer.alloc(16 * entries.length)
  let offset = header.length + dir.length
  entries.forEach(({ size, png }, i) => {
    const o = i * 16
    dir.writeUInt8(size >= 256 ? 0 : size, o)
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1)
    dir.writeUInt8(0, o + 2)
    dir.writeUInt8(0, o + 3)
    dir.writeUInt16LE(1, o + 4)
    dir.writeUInt16LE(32, o + 6)
    dir.writeUInt32LE(png.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += png.length
  })
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)])
}

async function shotAt(page, size) {
  await page.setViewportSize({ width: size, height: size })
  await page.evaluate((s) => {
    const svg = document.querySelector('svg')
    svg.setAttribute('width', String(s))
    svg.setAttribute('height', String(s))
  }, size)
  return page.screenshot({ omitBackground: true })
}

async function main() {
  mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.setContent(`<html><body style="margin:0;">${MARK_SVG}</body></html>`)

  const entries = []
  for (const size of WIN_SIZES) {
    entries.push({ size, png: await shotAt(page, size) })
  }
  writeFileSync(join(outDir, 'icon.ico'), buildIco(entries))
  writeFileSync(join(outDir, 'icon.png'), await shotAt(page, PNG_SIZE))

  await browser.close()
  console.log('wrote apps/shell/build/icon.ico and icon.png')
}

main()
