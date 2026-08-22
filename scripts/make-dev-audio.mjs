/**
 * Generate short silent MP3s for local/CI testing.
 *
 * The bundled ffmpeg in this image is Playwright's stripped build and cannot
 * demux or encode MP3, so the frames are emitted by hand. A silent MPEG-1
 * Layer III frame at a fixed bitrate is a well-defined byte pattern: a 4-byte
 * header followed by zeroed payload. Decoders read that as silence, which is
 * all a playback test needs — real duration, real seeking, no network.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'dev')

const SAMPLE_RATE = 44100
const SAMPLES_PER_FRAME = 1152
const BITRATE_KBPS = 64
// MPEG-1 Layer III frame size, no padding.
const FRAME_BYTES = Math.floor((SAMPLES_PER_FRAME / 8) * (BITRATE_KBPS * 1000) / SAMPLE_RATE)

function silentMp3(seconds) {
  const frameCount = Math.ceil((seconds * SAMPLE_RATE) / SAMPLES_PER_FRAME)
  const buf = Buffer.alloc(frameCount * FRAME_BYTES)
  for (let i = 0; i < frameCount; i++) {
    const o = i * FRAME_BYTES
    buf[o] = 0xff       // frame sync
    buf[o + 1] = 0xfb   // MPEG-1, Layer III, no CRC
    buf[o + 2] = 0x50   // 64 kbps, 44.1 kHz, no padding
    buf[o + 3] = 0xc4   // mono
  }
  return buf
}

mkdirSync(OUT_DIR, { recursive: true })

const fixtures = [
  { name: 'tone-a.mp3', seconds: 12 },
  { name: 'tone-b.mp3', seconds: 8 },
  { name: 'tone-c.mp3', seconds: 15 },
]

for (const { name, seconds } of fixtures) {
  const data = silentMp3(seconds)
  writeFileSync(join(OUT_DIR, name), data)
  console.log(`${name}  ${seconds}s  ${data.length} bytes`)
}
