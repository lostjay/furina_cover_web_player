# Furina Covers — web player

An Apple Music–style web player for Furina song covers. Light "Fontaine" theme by
default, with a full dark mode, a full-screen Now Playing view, time-synced
lyrics, search, a reorderable queue, and playlists.

Built with Vite + React + TypeScript. No runtime dependencies beyond React.

```bash
npm install
npm run dev          # http://localhost:5173/furina_cover_web_player/
```

## Adding your music

All content lives in [`public/tracks.json`](public/tracks.json). Nothing is
hard-coded — add a track by adding an entry, no code change needed.

```jsonc
{
  "version": 1,
  "albums": [{
    "id": "furina-covers",           // required, unique
    "title": "Furina Covers",        // required
    "artist": "Furina (RVC)",
    "year": 2025,
    "artworkUrl": "https://…/cover.jpg",   // optional, see Artwork below
    "tracks": [{
      "id": "chiling",                       // required, unique across the library
      "title": "赤伶",                        // required
      "audioUrl": "https://…/赤伶.mp3",       // required, a DIRECT audio file URL
      "artist": "Furina",                    // optional, defaults to the album artist
      "durationSec": 88,                     // optional, refined once the file loads
      "artworkUrl": "https://…/chiling.jpg", // optional, defaults to the album art
      "lyrics": [                            // optional — see Lyrics below
        { "t": 0, "text": "戏一折 水袖起落" }
      ]
    }]
  }]
}
```

The manifest is parsed forgivingly: a malformed track is skipped with a console
warning rather than breaking the whole library.

### `audioUrl` must be a direct file URL

It has to be something an `<audio>` element can play — an `.mp3`, `.m4a`, `.ogg`
served with an audio `Content-Type`. **YouTube and bilibili links will not work**;
those are web pages, not audio files.

Cross-origin URLs are fine and need no CORS headers — plain media playback
performs no CORS check. The player deliberately never sets `crossOrigin` on the
audio element, because doing so *would* opt into a check that many media hosts
fail. Redirects (e.g. an origin that 302s to presigned R2/S3 storage) are
followed transparently. For scrubbing to work, the host must honour `Range`
requests — most object storage does.

### Artwork

`artworkUrl` is optional. When it is missing — or the image fails to load — the
player renders an original generated SVG cover: a Fontaine-flavoured gradient
derived deterministically from the track id, so the same track always gets the
same cover. That keeps the repo free of copyrighted artwork and means the
full-screen backdrop always has something to work with.

### Lyrics

Either inline, with `t` in seconds:

```json
"lyrics": [{ "t": 12.4, "text": "台下人走过" }]
```

…or point `lrcUrl` at a standard `.lrc` file, which is fetched on demand. The
parser handles `[mm:ss]`, `[mm:ss.xx]`, `[mm:ss.xxx]`, the legacy `[mm:ss:xx]`
form, repeated timestamps on one line, and out-of-order lines. Tracks without
lyrics simply show an empty state.

## Keyboard shortcuts

| Key | Action | | Key | Action |
|---|---|---|---|---|
| <kbd>Space</kbd> | Play / pause | | <kbd>M</kbd> | Mute |
| <kbd>←</kbd> <kbd>→</kbd> | Seek ∓5s | | <kbd>N</kbd> / <kbd>P</kbd> | Next / previous |
| <kbd>↑</kbd> <kbd>↓</kbd> | Volume | | <kbd>F</kbd> | Full-screen player |
| <kbd>/</kbd> | Focus search | | <kbd>Esc</kbd> | Close overlay |

In the queue, <kbd>Alt</kbd> + <kbd>↑</kbd>/<kbd>↓</kbd> reorders the focused
track (the pointer equivalent is drag and drop).

## Development

```bash
npm run typecheck    # tsc --noEmit
npm run test         # unit tests: LRC parsing, queue logic, search matching
npm run fixture      # generate offline audio fixtures into public/dev/
npm run test:e2e     # drive the real UI in Chromium against those fixtures
npm run build        # typecheck + production bundle
```

`npm run test:e2e` needs `npm run fixture` first and a dev server running. It
loads `?manifest=dev`, a local fixture manifest, so the browser tests never
depend on network access or on remote media staying up.

## Deploying

The GitHub Actions workflow in `.github/workflows/deploy.yml` builds and
publishes to GitHub Pages on every push to the default branch. `vite.config.ts`
sets `base` to `/furina_cover_web_player/` to match the Pages project path; for
any other host, build with `BASE_PATH=/ npm run build`.

## Notes on the architecture

- A single long-lived `<audio>` element ([`src/audio/AudioEngine.ts`](src/audio/AudioEngine.ts))
  — replacing the element mid-session would lose the autoplay grant.
- Playback position is *not* React state. It changes several times a second, so
  it is exposed through `useSyncExternalStore` and consumed only by the scrubber
  and the lyrics pane, keeping the rest of the tree from re-rendering.
- Queue, shuffle and repeat live in a pure reducer
  ([`src/state/playerReducer.ts`](src/state/playerReducer.ts)) with no DOM access,
  so the awkward cases (boundaries under each repeat mode, shuffle round-trips,
  reordering across the play cursor) are unit-tested directly.
