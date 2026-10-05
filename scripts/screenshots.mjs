import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

/**
 * Regénère les visuels de `docs/screenshots/`. Deux temps :
 *
 * 1. Playwright capture Obskura dans dix états, en DPR 2. La session est
 *    dessinée au canvas dans la page — pas de sortie de modèle, ni clé ni réseau.
 * 2. screenmat (https://github.com/samuelboulery/screenmat) encadre chaque
 *    capture : fenêtre de navigateur, fond `mesh` à palette figée, même graine,
 *    donc un rendu identique d'une fois sur l'autre.
 *
 *   pnpm dev                                          # dans un autre terminal
 *   SCREENMAT=../screenmat node scripts/screenshots.mjs
 *
 * Sans SCREENMAT, seules les captures brutes sont écrites (dossier temporaire).
 *
 * ponytail: un script qui ouvre un navigateur, clique et écrit des fichiers —
 * pas de reporter ni de fixture Playwright.
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const OUT = mkdtempSync(join(tmpdir(), 'obskura-shots-')) + '/'
const DOCS = new URL('../docs/screenshots/', import.meta.url).pathname
const PALETTE = { base: '#15110f', accents: ['#9a4632', '#3e4c6e', '#c9824e'] }

const browser = await chromium.launch()

async function seed(page, { lang = 'fr', theme = 'dark' } = {}) {
  await page.goto(`${BASE}/app`)
  await page.evaluate(({ lang, theme }) => {
    const rand = (() => {
      let s = 7
      return () => ((s = (s * 16807) % 2147483647) / 2147483647)
    })()

    function canvas(w, h) {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      return [c, c.getContext('2d')]
    }
    function sky(g, w, h, stops) {
      const gr = g.createLinearGradient(0, 0, 0, h)
      stops.forEach(([o, col]) => gr.addColorStop(o, col))
      g.fillStyle = gr
      g.fillRect(0, 0, w, h)
    }
    function ridge(g, w, h, base, amp, col, rough) {
      g.fillStyle = col
      g.beginPath()
      g.moveTo(0, h)
      let y = base
      for (let x = 0; x <= w; x += 8) {
        y += (rand() - 0.5) * rough
        y = Math.max(base - amp, Math.min(base + amp, y))
        g.lineTo(x, y)
      }
      g.lineTo(w, h)
      g.fill()
    }
    function grain(g, w, h, a = 0.06) {
      const img = g.getImageData(0, 0, w, h)
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (rand() - 0.5) * 255 * a
        img.data[i] += n
        img.data[i + 1] += n
        img.data[i + 2] += n
      }
      g.putImageData(img, 0, 0)
    }

    const art = {
      dunes(w, h) {
        const [c, g] = canvas(w, h)
        sky(g, w, h, [[0, '#2b2445'], [0.45, '#c8624a'], [0.62, '#f3b27a']])
        g.fillStyle = '#ffd9a0'
        g.beginPath()
        g.arc(w * 0.68, h * 0.52, h * 0.07, 0, 7)
        g.fill()
        ;[['#b5563d', 0.62], ['#8f3f33', 0.7], ['#62302e', 0.8], ['#3b2229', 0.9]].forEach(([col, b], i) => {
          g.fillStyle = col
          g.beginPath()
          g.moveTo(0, h)
          for (let x = 0; x <= w; x += 6) g.lineTo(x, h * b + Math.sin(x / (w * (0.18 + i * 0.05)) + i * 1.7) * h * 0.05)
          g.lineTo(w, h)
          g.fill()
        })
        grain(g, w, h)
        return c
      },
      vase(w, h) {
        const [c, g] = canvas(w, h)
        sky(g, w, h, [[0, '#d9d2c4'], [1, '#b8ad99']])
        const light = g.createLinearGradient(w * 0.2, 0, w * 0.8, h)
        light.addColorStop(0, 'rgba(255,248,230,0.55)')
        light.addColorStop(1, 'rgba(255,248,230,0)')
        g.fillStyle = light
        g.fillRect(0, 0, w, h)
        g.fillStyle = '#8e8474'
        g.fillRect(0, h * 0.7, w, h * 0.3)
        g.fillStyle = 'rgba(40,30,20,0.28)'
        g.beginPath()
        g.ellipse(w * 0.58, h * 0.72, w * 0.2, h * 0.035, 0, 0, 7)
        g.fill()
        const body = g.createLinearGradient(w * 0.38, 0, w * 0.62, 0)
        body.addColorStop(0, '#f1ece2')
        body.addColorStop(0.55, '#cfc5b4')
        body.addColorStop(1, '#8c826f')
        g.fillStyle = body
        g.beginPath()
        g.moveTo(w * 0.46, h * 0.28)
        g.bezierCurveTo(w * 0.44, h * 0.38, w * 0.36, h * 0.46, w * 0.38, h * 0.58)
        g.bezierCurveTo(w * 0.4, h * 0.7, w * 0.6, h * 0.7, w * 0.62, h * 0.58)
        g.bezierCurveTo(w * 0.64, h * 0.46, w * 0.56, h * 0.38, w * 0.54, h * 0.28)
        g.closePath()
        g.fill()
        g.fillStyle = '#6b604f'
        g.beginPath()
        g.ellipse(w * 0.5, h * 0.28, w * 0.04, h * 0.012, 0, 0, 7)
        g.fill()
        grain(g, w, h, 0.05)
        return c
      },
      mountains(w, h) {
        const [c, g] = canvas(w, h)
        sky(g, w, h, [[0, '#9fb4c4'], [0.6, '#dfe3dc'], [1, '#eef0ea']])
        ;[['#b7c3c6', 0.42, 0.1], ['#8fa0a6', 0.52, 0.09], ['#617479', 0.63, 0.08], ['#3c4c50', 0.74, 0.06], ['#243034', 0.86, 0.05]].forEach(
          ([col, b, a]) => ridge(g, w, h, h * b, h * a, col, h * 0.03)
        )
        grain(g, w, h, 0.04)
        return c
      },
      lighthouse(w, h) {
        const [c, g] = canvas(w, h)
        sky(g, w, h, [[0, '#1b2433'], [0.55, '#3d4d63'], [0.62, '#6f7f8f']])
        g.fillStyle = '#26303d'
        g.fillRect(0, h * 0.62, w, h * 0.38)
        for (let i = 0; i < 40; i++) {
          g.strokeStyle = `rgba(200,215,230,${0.05 + rand() * 0.1})`
          g.beginPath()
          const y = h * (0.64 + rand() * 0.34)
          g.moveTo(rand() * w, y)
          g.lineTo(rand() * w, y + (rand() - 0.5) * 6)
          g.stroke()
        }
        g.fillStyle = '#1a1f26'
        g.beginPath()
        g.moveTo(w * 0.2, h * 0.66)
        g.lineTo(w * 0.8, h * 0.66)
        g.lineTo(w * 0.7, h * 0.6)
        g.lineTo(w * 0.3, h * 0.6)
        g.fill()
        g.fillStyle = '#e8e2d6'
        g.beginPath()
        g.moveTo(w * 0.44, h * 0.6)
        g.lineTo(w * 0.56, h * 0.6)
        g.lineTo(w * 0.535, h * 0.3)
        g.lineTo(w * 0.465, h * 0.3)
        g.fill()
        g.fillStyle = '#b03a2e'
        ;[0.36, 0.46, 0.55].forEach((y) => g.fillRect(w * 0.44, h * y, w * 0.12, h * 0.03))
        const beam = g.createRadialGradient(w * 0.5, h * 0.28, 2, w * 0.5, h * 0.28, w * 0.9)
        beam.addColorStop(0, 'rgba(255,236,170,0.9)')
        beam.addColorStop(0.08, 'rgba(255,236,170,0.35)')
        beam.addColorStop(1, 'rgba(255,236,170,0)')
        g.fillStyle = beam
        g.beginPath()
        g.moveTo(w * 0.5, h * 0.28)
        g.lineTo(-w * 0.2, h * 0.18)
        g.lineTo(-w * 0.2, h * 0.3)
        g.fill()
        g.fillStyle = '#fff1c2'
        g.fillRect(w * 0.47, h * 0.265, w * 0.06, h * 0.03)
        grain(g, w, h, 0.07)
        return c
      },
      bauhaus(w, h) {
        const [c, g] = canvas(w, h)
        g.fillStyle = '#efe7d6'
        g.fillRect(0, 0, w, h)
        g.fillStyle = '#d2482e'
        g.beginPath()
        g.arc(w * 0.36, h * 0.4, w * 0.2, 0, 7)
        g.fill()
        g.fillStyle = '#1f3a5f'
        g.fillRect(w * 0.48, h * 0.44, w * 0.34, h * 0.34)
        g.fillStyle = '#e9b03b'
        g.beginPath()
        g.moveTo(w * 0.18, h * 0.86)
        g.lineTo(w * 0.52, h * 0.86)
        g.lineTo(w * 0.35, h * 0.58)
        g.fill()
        g.strokeStyle = '#1c1c1c'
        g.lineWidth = w * 0.012
        g.beginPath()
        g.moveTo(w * 0.1, h * 0.14)
        g.lineTo(w * 0.9, h * 0.14)
        g.stroke()
        grain(g, w, h, 0.04)
        return c
      },
    }

    const now = Date.now()
    const P = {
      dunes: 'Dunes at dusk, long shadows, warm haze, 35 mm film',
      vase: 'A ceramic vase on raw linen, low winter light, shallow depth of field',
      mountains: 'Layered mountain ridges in morning mist, muted palette',
      lighthouse: 'A lighthouse in a night storm, beam cutting the rain, vertical',
      bauhaus: 'Bauhaus poster, primary shapes, paper texture',
    }
    const base = {
      negative: '', seedLock: false, palette: null, thumb: null, parentId: null, recipeId: null, costEur: 0.04,
    }
    const spec = [
      ['vase', '4:3', [1600, 1200], 'nano-banana-2', 0, ['#d9d2c4', '#8e8474', '#cfc5b4']],
      ['vase', '4:3', [1600, 1200], 'gpt-image-2.5-flare', 0, ['#d9d2c4', '#8c826f', '#f1ece2']],
      ['dunes', '16:9', [1920, 1080], 'nano-banana-2', 1, ['#c8624a', '#3b2229', '#f3b27a']],
      ['dunes', '16:9', [1920, 1080], 'nano-banana-2', 1, ['#b5563d', '#2b2445', '#ffd9a0']],
      ['lighthouse', '9:16', [900, 1600], 'gpt-image-2', 2, ['#1b2433', '#e8e2d6', '#b03a2e']],
      ['mountains', '16:9', [1920, 1080], 'nano-banana-2', 3, ['#8fa0a6', '#243034', '#dfe3dc']],
      ['bauhaus', '1:1', [1200, 1200], 'gpt-image-2.5-sunburst', 4, ['#d2482e', '#1f3a5f', '#e9b03b']],
    ]
    const items = spec.map(([kind, ratio, [w, h], adapterId, group, palette], index) => {
      const url = art[kind](w, h).toDataURL('image/jpeg', 0.9)
      return {
        ...base,
        id: crypto.randomUUID(),
        result: { imageBase64: url.split(',')[1], mimeType: 'image/jpeg' },
        adapterId,
        prompt: P[kind],
        negative: kind === 'vase' ? 'text, watermark' : '',
        seed: 4471902 + index * 37,
        params: {
          aspectRatio: ratio, resolution: '2K', batch: 1, seed: null, seedLock: false, fileFormat: 'png',
          transparent: false, compression: 80, personGeneration: 'allow_adult', moderation: 'auto',
          language: 'auto', extraParams: [],
        },
        palette,
        latencyMs: 11_000 + index * 1300,
        createdAt: new Date(now - group * 240_000).toISOString(),
      }
    })
    localStorage.clear()
    localStorage.setItem('imgc.session', JSON.stringify(items))
    localStorage.setItem('gemini_api_key', 'demo')
    localStorage.setItem('openai_api_key', 'demo')
    const prefs = JSON.parse(localStorage.getItem('imgc.prefs') ?? '{}')
    localStorage.setItem('imgc.prefs', JSON.stringify({ ...prefs, lang, theme }))
    localStorage.setItem(
      'imgc.recipes',
      JSON.stringify([
        { id: 'r1', name: 'Nature morte matinale', subjectImages: [], subjectWeight: 60, styleImages: [], styleWeight: 60, identityLock: false, paletteTransfer: false, promptSuffix: 'soft window light', negative: 'text, watermark', params: { aspectRatio: '4:3', resolution: '2K' } },
        { id: 'r2', name: 'Affiche 1:1', subjectImages: [], subjectWeight: 60, styleImages: [], styleWeight: 60, identityLock: false, paletteTransfer: false, promptSuffix: '', negative: '', params: { aspectRatio: '1:1', resolution: '4K' } },
      ])
    )
  }, { lang, theme })
  await page.reload()
  await page.getByRole('navigation', { name: /Session/ }).getByRole('button').first().waitFor()
  await page.evaluate(() => document.querySelector('nextjs-portal')?.remove())
}

async function shot(page, name) {
  await page.evaluate(() => {
    document.querySelector('nextjs-portal')?.remove()
  })
  await page.mouse.move(0, 0)
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${OUT}${name}.png` })
  console.log(name)
}

const strip = (page) => page.getByRole('navigation', { name: /Session/ })
const thumbs = (page) => strip(page).locator('[data-strip-item]')

async function newPage(opts = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, ...opts })
  return page
}

// 1. Fiche d'une image
{
  const page = await newPage()
  await seed(page)
  await thumbs(page).nth(0).click()
  await page.getByLabel('Prompt', { exact: true }).fill('A ceramic vase on raw linen, low winter light, shallow depth of field')
  await page.evaluate(() => document.activeElement?.blur())
  await shot(page, '01-fiche-image')

  // 2. Paire : deux modèles, même prompt
  await thumbs(page).nth(1).click({ modifiers: ['Shift'] })
  await shot(page, '02-comparaison')

  // 3. Sélection multiple : export
  await thumbs(page).nth(2).click({ modifiers: ['Shift'] })
  await thumbs(page).nth(4).click({ modifiers: ['Shift'] })
  await thumbs(page).nth(6).click({ modifiers: ['Shift'] })
  await shot(page, '03-export')

  // 4. Réglages, menu Modèle ouvert
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /Nano Banana 2/ }).first().click()
  await shot(page, '04-menu-modele')

  // 5. Palette ⌘K
  await page.keyboard.press('Escape')
  await page.keyboard.press('ControlOrMeta+k')
  await page.keyboard.type('gpt')
  await shot(page, '05-palette')
  await page.keyboard.press('Escape')

  // 6. Historique
  await page.getByRole('button', { name: 'Historique' }).click()
  await shot(page, '06-historique')

  // 11. La requête réelle, dans la section Avancé
  await page.keyboard.press('Escape')
  await page.getByText('Avancé', { exact: true }).click()
  await page.evaluate(() => {
    const panel = document.querySelector('aside .overflow-y-auto')
    if (panel) panel.scrollTop = panel.scrollHeight
  })
  await shot(page, '11-requete')
  await page.close()
}

// 7. Génération en cours, deux modèles en parallèle
{
  const page = await newPage()
  await seed(page)
  await page.route('**/api/generate', () => {}) // jamais de réponse : l'attente reste à l'écran
  await page.getByRole('button', { name: /Nano Banana 2/ }).first().click()
  await page.getByRole('menuitemcheckbox').nth(2).click()
  await page.keyboard.press('Escape')
  await page.getByLabel('Prompt', { exact: true }).fill('A glass greenhouse at dawn, condensation on the panes, soft green light')
  await page.getByRole('button', { name: /^Générer/ }).click()
  await page.waitForTimeout(9_000)
  await shot(page, '07-en-parallele')
  await page.close()
}

// 8. Premier contact, clé demandée sur la scène
{
  const page = await newPage()
  await page.goto(`${BASE}/app`)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByLabel('Prompt', { exact: true }).fill('A paper lantern floating over a still lake')
  await page.getByRole('button', { name: /^Générer/ }).click()
  await page.getByRole('form', { name: /Coller une clé/ }).waitFor()
  await page.evaluate(() => document.activeElement?.blur())
  await shot(page, '08-cle-demandee')
  await page.close()
}

// 9. Thème clair, en anglais
{
  const page = await newPage()
  await seed(page, { lang: 'en', theme: 'light' })
  await thumbs(page).nth(5).click()
  await shot(page, '09-light-en')
  await page.close()
}

// 10. Mobile
{
  const page = await newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 })
  await seed(page)
  await shot(page, '10-mobile')
  await page.close()
}

await browser.close()

const screenmat = process.env.SCREENMAT
if (!screenmat) {
  console.log(`Captures brutes dans ${OUT} — SCREENMAT non défini, pas d'encadrement.`)
  process.exit(0)
}

mkdirSync(DOCS, { recursive: true })
for (const file of readdirSync(OUT).filter((name) => name.endsWith('.png'))) {
  const name = file.replace(/\.png$/, '')
  const spec = join(OUT, `${name}.json`)
  writeFileSync(spec, JSON.stringify({ palette: PALETTE, shots: [{ input: join(OUT, file) }] }))
  const frame =
    name === '10-mobile'
      ? ['--frame', 'iphone', '--ratio', '4:3']
      : ['--frame', 'browser', '--url', 'localhost:3000', '--ratio', '16:9']
  execFileSync(
    'pnpm',
    ['-s', 'cli', '--spec', spec, ...frame, '--background', 'mesh', '--seed', '3', '-o', `${DOCS}${name}-screenmat.webp`],
    { cwd: screenmat, stdio: 'inherit' }
  )
}
