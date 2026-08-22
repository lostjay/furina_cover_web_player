import { chromium } from 'playwright'

const BASE = 'http://localhost:5173/furina_cover_web_player/'
const fail = []
const ok = (label, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!cond) fail.push(label)
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
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

// Full screen + lyrics
await page.keyboard.press('f')
await page.waitForTimeout(600)
ok('full screen opens', await page.locator('.fullscreen').isVisible())
const lyricCount = await page.locator('.lyric-line').count()
ok('lyrics render', lyricCount === 4, `lines=${lyricCount}`)
const active = await page.locator('.lyric-line.is-active').innerText()
ok('lyric line syncs to ~6s', active.includes('无关我'), `active="${active}"`)
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

ok('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

console.log('\n' + (fail.length ? `FAILURES: ${fail.join(', ')}` : 'ALL FIXTURE CHECKS PASSED'))
await browser.close()
process.exit(fail.length ? 1 : 0)
