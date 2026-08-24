import { chromium } from 'playwright'

const BASE = 'http://localhost:5173/'
const fail = []
const ok = (label, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!cond) fail.push(label)
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio',
    // AMLL's BackgroundRender needs WebGL; headless has no GPU, so render
    // through SwiftShader rather than silently losing the background.
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

// --- fixture manifest: fully offline ---------------------------------
await page.goto(BASE + '?manifest=dev', { waitUntil: 'networkidle' })
await page.waitForSelector('.track-row')

const rows = await page.locator('.track-row').count()
ok('library renders fixture tracks', rows === 3, `rows=${rows}`)

// A single-album manifest opens on the album hero, and the Albums nav section
// is suppressed because it would just duplicate "Songs".
ok('opens on the album hero', await page.locator('.album-hero').count() === 1)
ok('Albums nav hidden for a single album',
   (await page.locator('.nav-heading', { hasText: 'Albums' }).count()) === 0)
ok('CJK title renders', (await page.locator('.track-title').first().innerText()).includes('赤伶'))

// Click the first track and confirm real playback.
await page.locator('.track-row').first().click()
await page.waitForTimeout(1400)

const audio = await page.evaluate(() => {
  const el = document.querySelector('audio[data-audio-engine="main"]')
  return el ? { paused: el.paused, currentTime: el.currentTime, duration: el.duration, src: el.currentSrc, crossOrigin: el.crossOrigin } : null
})
ok('audio element exists', audio !== null)
ok('audio is playing', audio && audio.paused === false, JSON.stringify(audio))
ok('currentTime advanced', audio && audio.currentTime > 0.3, `t=${audio?.currentTime?.toFixed(2)}`)
ok('duration decoded ~12s', audio && Math.abs(audio.duration - 12) < 1.5, `d=${audio?.duration?.toFixed(2)}`)
ok('crossOrigin NOT set (would break on this media host)', audio && !audio.crossOrigin, `crossOrigin=${JSON.stringify(audio?.crossOrigin)}`)

// Seeking
await page.evaluate(() => { document.querySelector('audio[data-audio-engine="main"]').currentTime = 6 })
await page.waitForTimeout(500)
const afterSeek = await page.evaluate(() => document.querySelector('audio[data-audio-engine="main"]').currentTime)
ok('seek works', afterSeek > 5.5, `t=${afterSeek.toFixed(2)}`)

// --- full screen: AMLL lyric player + background ----------------------
await page.keyboard.press('f')
await page.waitForTimeout(1200)
ok('full screen opens', await page.locator('.fullscreen').isVisible())

// AMLL renders its own DOM inside our container rather than our old .lyric-line
// markup, so assert on the text it produced from the word-level TTML fixture.
// The lyrics are fetched and parsed asynchronously once the pane mounts, so
// wait for content rather than racing a fixed timeout.
await page
  .waitForFunction(() => (document.querySelector('.fs-lyrics')?.textContent ?? '').includes('Alpha'), null, { timeout: 8000 })
  .catch(() => {})
const lyricText = await page.locator('.fs-lyrics').innerText()
ok('AMLL parsed the TTML fixture', lyricText.includes('Alpha') && lyricText.includes('papa'),
   JSON.stringify(lyricText.replace(/\s+/g, ' ').slice(0, 90)))

// The background: either a live WebGL canvas, or the documented CSS fallback.
const bg = await page.evaluate(() => {
  const canvas = document.querySelector('.fs-bg-render canvas')
  if (canvas) {
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    return { mode: 'webgl', ok: !!gl, w: canvas.width, h: canvas.height }
  }
  return { mode: 'fallback', ok: !!document.querySelector('.fs-backdrop img') }
})
ok(`background renders (${bg.mode})`, bg.ok, JSON.stringify(bg))

// The actual point of adopting AMLL: the highlight must move WITHIN a line,
// not just between lines. Sample the first line's word spans at two times
// inside it and require the rendered mask/opacity to differ.
const wordProgress = await page.evaluate(async () => {
  const el = document.querySelector('audio[data-audio-engine="main"]')
  const sample = async (t) => {
    el.currentTime = t
    await new Promise((r) => setTimeout(r, 700))
    const spans = [...document.querySelectorAll('.fs-lyrics span')]
      .filter((s) => s.children.length === 0 && s.textContent.trim())
    return spans.slice(0, 6).map((s) => {
      const cs = getComputedStyle(s)
      return `${cs.opacity}|${cs.maskImage ?? ''}|${cs.filter}|${cs.color}`
    }).join('~')
  }
  const early = await sample(0.2)   // during "Alpha"
  const late = await sample(2.6)    // during "delta", same line
  return { early, late, differs: early !== late, sampled: early.split('~').length }
})
ok('word-level highlight advances within one line', wordProgress.differs,
   `spans=${wordProgress.sampled}`)

// Click-to-seek must survive the component swap.
await page.evaluate(() => { document.querySelector('audio[data-audio-engine="main"]').currentTime = 0 })
await page.waitForTimeout(400)
const lineToClick = page.locator('.fs-lyrics div').filter({ hasText: 'India' }).last()
if (await lineToClick.count()) {
  await lineToClick.click({ force: true })
  await page.waitForTimeout(600)
  const t = await page.evaluate(() => document.querySelector('audio[data-audio-engine="main"]').currentTime)
  ok('clicking a lyric line seeks', t > 5.5 && t < 7.5, `t=${t.toFixed(2)}`)
} else {
  ok('clicking a lyric line seeks', false, 'could not locate the line element')
}

await page.evaluate(() => { document.querySelector('audio[data-audio-engine="main"]').currentTime = 4 })
await page.waitForTimeout(800)
await page.screenshot({ path: '/tmp/shots/03-fullscreen-light.png' })

// Dark theme in full screen
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
await page.waitForTimeout(350)
await page.screenshot({ path: '/tmp/shots/04-fullscreen-dark.png' })
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))

await page.keyboard.press('Escape')
await page.waitForTimeout(400)
ok('escape closes full screen', await page.locator('.fullscreen').count() === 0)

// Queue reorder
await page.locator('.bar-right .icon-btn').last().click()
await page.waitForTimeout(400)
ok('queue panel opens', await page.locator('.queue-panel').isVisible())
const before = await page.locator('.queue-title').allInnerTexts()
await page.locator('.queue-item').nth(2).focus()
await page.keyboard.press('Alt+ArrowUp')
await page.waitForTimeout(300)
const after = await page.locator('.queue-title').allInnerTexts()
ok('alt+arrow reorders queue', JSON.stringify(before) !== JSON.stringify(after), `${before} -> ${after}`)
await page.screenshot({ path: '/tmp/shots/05-queue.png' })
await page.locator('.queue-head .icon-btn').click()

// Search
await page.locator('.search input').fill('伶')
await page.waitForTimeout(400)
ok('CJK search filters', await page.locator('.track-row').count() === 1)
await page.locator('.search input').fill('zzzz')
await page.waitForTimeout(300)
ok('no-results state shows', await page.locator('.empty').isVisible())
await page.locator('.search input').fill('')

// Next track
await page.waitForTimeout(300)
await page.locator('.transport .icon-btn').nth(1).click() // prev/next area
await page.waitForTimeout(200)

// Library screenshots
await page.screenshot({ path: '/tmp/shots/01-library-light.png' })
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
await page.waitForTimeout(350)
await page.screenshot({ path: '/tmp/shots/02-library-dark.png' })


// ---------------------------------------------------------------------
// Mobile pass. This suite only ever ran at 1280x860, which is exactly why
// `.fs-lyrics { display: none }` below 900px went unnoticed — the lyrics were
// invisible on every phone. Guard the narrow layout permanently.
// ---------------------------------------------------------------------
const phone = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
const phoneErrors = []
phone.on('pageerror', (e) => phoneErrors.push(String(e)))
phone.on('console', (m) => { if (m.type() === 'error') phoneErrors.push(m.text()) })

await phone.goto(BASE + '?manifest=dev', { waitUntil: 'networkidle' })
await phone.waitForSelector('.track-row')
await phone.locator('.track-row').first().click()
await phone.waitForTimeout(1200)

// Full screen must be reachable by tap — there is no F key on a phone.
await phone.locator('.bar-track button').last().click()
await phone.waitForTimeout(1200)
ok('[mobile] full screen opens by tap', await phone.locator('.fullscreen').count() === 1)

const toggle = phone.locator('.fs-head button[aria-pressed]')
ok('[mobile] lyrics toggle is present', await toggle.count() === 1)
ok('[mobile] starts on artwork, lyrics off',
   (await toggle.getAttribute('aria-pressed')) === 'false')

await toggle.click()
await phone.waitForTimeout(2000)

const m = await phone.evaluate(() => {
  const box = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const b = el.getBoundingClientRect()
    return { w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top), bottom: Math.round(b.bottom) }
  }
  const controls = box('.fs-controls')
  const lines = [...document.querySelectorAll('.FmKaba_lyricLineWrapper')].map((w) => {
    const b = w.getBoundingClientRect()
    return { h: Math.round(b.height), top: Math.round(b.top), bottom: Math.round(b.bottom) }
  })
  return {
    lyrics: box('.fs-lyrics'),
    compact: box('.fs-compact'),
    art: box('.fs-art'),
    controls,
    onScreen: lines.filter((l) => l.h > 0 && l.bottom > 0 && l.top < window.innerHeight).length,
    overlapping: controls
      ? lines.filter((l) => l.h > 0 && l.bottom > controls.top && l.top < controls.bottom).length
      : -1,
  }
})

// The specific regression: the pane was 350x0. A display check alone would
// have passed while showing nothing, so assert real height.
ok('[mobile] lyrics pane has real height', (m.lyrics?.h ?? 0) > 200, JSON.stringify(m.lyrics))
ok('[mobile] lyric lines are on screen', m.onScreen > 0, `onScreen=${m.onScreen}`)
ok('[mobile] lyrics never overlap the transport', m.overlapping === 0, `overlapping=${m.overlapping}`)
ok('[mobile] artwork collapses to the compact row',
   (m.compact?.h ?? 0) > 0 && (m.art?.h ?? 0) === 0, JSON.stringify({ compact: m.compact?.h, art: m.art?.h }))

await phone.screenshot({ path: '/tmp/shots/22-mobile-lyrics.png' })
await phone.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
await phone.waitForTimeout(500)
await phone.screenshot({ path: '/tmp/shots/24-mobile-lyrics-dark.png' })
await phone.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))

await toggle.click()
await phone.waitForTimeout(1000)
const back = await phone.evaluate(() => ({
  art: document.querySelector('.fs-art')?.getBoundingClientRect().height ?? 0,
  lyrics: document.querySelector('.fs-lyrics') !== null,
}))
ok('[mobile] toggling back restores the artwork', back.art > 100 && !back.lyrics, JSON.stringify(back))
await phone.screenshot({ path: '/tmp/shots/23-mobile-artwork.png' })

ok('[mobile] no uncaught errors', phoneErrors.length === 0, phoneErrors.slice(0, 2).join(' | '))
await phone.close()

ok('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

console.log('\n' + (fail.length ? `FAILURES: ${fail.join(', ')}` : 'ALL FIXTURE CHECKS PASSED'))
await browser.close()
process.exit(fail.length ? 1 : 0)
