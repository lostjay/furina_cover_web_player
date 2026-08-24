# Furina Covers — web player

An Apple Music–style web player for Furina song covers. Light "Fontaine" theme by
default, with a full dark mode, a full-screen Now Playing view, time-synced
lyrics, search, a reorderable queue, and playlists.

Built with Vite + React + TypeScript, using [AMLL](https://github.com/amll-dev/applemusic-like-lyrics)
for the lyric player and the fluid artwork background.

```bash
npm install
npm run dev          # http://localhost:5173/
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

Cross-origin audio URLs need no CORS headers — plain media playback performs no
CORS check, and the player deliberately never sets `crossOrigin` on the audio
element because that *would* opt into a check many media hosts fail. For
scrubbing, the host must honour `Range` requests — most object storage does.

### CORS *is* required for lyrics and the fluid background

Two things are not like audio, because they are read rather than merely
played, and both are CORS-checked:

| What | How it is loaded |
|---|---|
| Lyric files (`lrcUrl` / `ttmlUrl`) | `fetch()` |
| Background artwork | AMLL does `fetch(url).blob()` **and** sets `img.crossOrigin = "anonymous"` |

So a media host must send a **valid** `Access-Control-Allow-Origin`. Valid means
`*`, `null`, or one exact origin, compared as a literal string — **a wildcard in
the subdomain position such as `https://*.example.com` is not legal and matches
nothing.**

This matters here because the player is served from `furina-cover.lostjay.xyz`
while the media lives on `lostjay.xyz`. **A subdomain is a separate origin**, so
those requests are cross-origin and the header is required. For nginx, either:

```nginx
# Allow any lostjay.xyz subdomain, by reflecting the request's Origin.
map $http_origin $cors_origin {
    default "";
    "~^https://([a-z0-9-]+\.)?lostjay\.xyz$" $http_origin;
}
add_header Access-Control-Allow-Origin $cors_origin always;
add_header Vary Origin always;   # or caches will hand the wrong ACAO to others
```

```nginx
# Or, simplest for public media:
add_header Access-Control-Allow-Origin "*" always;
```

Cover art shown in the track list and album header is a plain `<img>` and works
without any of this CORS setup at all — only the animated background needs
read access.

#### `/public/…` URLs get one extra hop, to dodge a "null origin" trap

`lostjay.xyz` fronts object storage (Cloudflare R2): a plain GET for a
`/public/…` path 302-redirects to a presigned R2 URL rather than serving the
file itself. Naively `fetch()`-ing that path directly runs into a corner of
the fetch spec: once a cross-origin request changes origin *again* on a
redirect, the browser resends the follow-up request with `Origin: null` — and
R2's CORS policy, which matches real origins, doesn't match `null`. The read
then fails with an opaque CORS error even though the CORS setup above is
otherwise correct.

The fix is to never let the browser follow that redirect. Request the same
path with `Accept: application/json` and the host answers with
`{ "url": "<direct R2 URL>" }` (HTTP 200) instead of redirecting.
[`src/media/resolveMediaUrl.ts`](src/media/resolveMediaUrl.ts) does this for
every `/public/…` URL in the manifest — artwork, audio, and lyrics alike —
before anything else touches it, so the rest of the app only ever sees a
direct, already-CORS-correct CDN URL. A URL outside `/public/…` is left
untouched: no extra request, no assumption that the host speaks this
convention.

Because of this, `Backdrop` no longer needs to probe whether the artwork is
readable before handing it to `BackgroundRender` — it always is, by
construction. The generated-gradient fallback still exists, but only for the
simpler case of a track with no `artworkUrl` at all (see Artwork below); a
`/public/…` URL that is genuinely unreachable (bad path, expired link) is a
broken manifest entry, not a CORS problem, and is left to fail visibly rather
than silently swapped for something else.

### Artwork

Set `artworkUrl` once on the album and every track inherits it; a track may
override it individually.

For best results the file should be **square** (it is cropped to a square with
`object-fit: cover`), a **real JPEG or WebP**, and **under a few hundred KB** —
it is fetched again for the full-screen background, so a multi-megabyte PNG is
felt twice.

`artworkUrl` is optional. When it is missing — or the image fails to load — the
player renders an original generated SVG cover: a Fontaine-flavoured gradient
derived deterministically from the track id, so the same track always gets the
same cover. That keeps the repo free of copyrighted artwork and means the
full-screen backdrop always has something to work with.

### Lyrics

Lyrics are rendered by [AMLL](https://github.com/amll-dev/applemusic-like-lyrics)
(`LyricPlayer`), and parsed by `@applemusic-like-lyrics/lyric`, so every format
that library supports works. Point a track at a file:

```jsonc
"ttmlUrl": "https://…/chiling.ttml"   // word-level, best quality
"lrcUrl":  "https://…/chiling.lrc"    // line-level
"lyricsFormat": "yrc"                  // optional; overrides the guess from the extension
```

The format is inferred from the extension (`.ttml`/`.xml`, `.lrc`, `.yrc`,
`.qrc`, `.lys`) unless `lyricsFormat` says otherwise.

**For word-by-word karaoke highlighting you want TTML.** LRC can only express
one timestamp per line, so an LRC file highlights whole lines at a time.

> **TTML gotcha:** AMLL's parser silently drops any `<p>` element without an
> `itunes:key` attribute — a structurally valid TTML file with no keys parses to
> *zero* lines and shows the empty state. Declare
> `xmlns:itunes="http://music.apple.com/lyric-ttml-internal"` and give every line
> a key:
>
> ```xml
> <p itunes:key="L1" begin="0.000" end="3.000" ttm:agent="v1">
>   <span begin="0.000" end="0.750">Alpha </span><span begin="0.750" end="1.500">bravo</span>
> </p>
> ```
>
> `scripts/make-dev-audio.mjs` generates a small valid example at
> `public/dev/fixture.ttml` you can copy the shape from.

The simple inline form still works and is converted to AMLL's model for you,
but it cannot express word timing:

```json
"lyrics": [{ "t": 12.4, "text": "台下人走过" }]
```

Tracks with no lyrics show a quiet empty state.

## Keyboard shortcuts

| Key | Action | | Key | Action |
|---|---|---|---|---|
| <kbd>Space</kbd> | Play / pause | | <kbd>M</kbd> | Mute |
| <kbd>←</kbd> <kbd>→</kbd> | Seek ∓5s | | <kbd>N</kbd> / <kbd>P</kbd> | Next / previous |
| <kbd>↑</kbd> <kbd>↓</kbd> | Volume | | <kbd>F</kbd> | Full-screen player |
| <kbd>/</kbd> | Focus search | | <kbd>Esc</kbd> | Close overlay |
| <kbd>L</kbd> | Lyrics: open the player, or toggle lyrics once it is open | | | |

In the queue, <kbd>Alt</kbd> + <kbd>↑</kbd>/<kbd>↓</kbd> reorders the focused
track (the pointer equivalent is drag and drop).

### Lyrics on small screens

Wide screens show artwork and lyrics side by side. Below 900px there is only
room for one, so the full-screen player opens on the artwork and the lyrics
button in its header switches between the two — the artwork collapses to a
compact row and the lyrics take the freed height, as Apple Music does on
iPhone. The choice follows the viewport until you set it yourself.

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
depend on network access or on remote media staying up. It launches Chromium
with SwiftShader because AMLL's background renderer needs WebGL and CI machines
have no GPU; if WebGL is genuinely unavailable the app falls back to a CSS blur
backdrop, and the suite asserts that path instead.

## Deploying

The site runs at **`furina-cover.lostjay.xyz`**, served from that host's root,
so `vite.config.ts` sets `base` to `/`.

The GitHub Actions workflow in `.github/workflows/deploy.yml` builds and
publishes to GitHub Pages on every push to the default branch. `public/CNAME`
carries the custom domain — GitHub Pages clears the domain setting on each
deploy unless that file is in the published output. If you serve the subdomain
from your own server instead, `public/CNAME` and the workflow are both inert and
can be deleted.

To publish under a GitHub Pages *project* path (`/<repo>/`) instead, build with:

```bash
BASE_PATH=/furina_cover_web_player/ npm run build
```

## Notes on the architecture

- A single long-lived `<audio>` element ([`src/audio/AudioEngine.ts`](src/audio/AudioEngine.ts))
  — replacing the element mid-session would lose the autoplay grant.
- Playback position is *not* React state, and there are two stores for it:
  `timeupdate` (~4Hz) drives the scrubber, while a `requestAnimationFrame` loop
  supplies integer milliseconds to AMLL, which needs that resolution for
  word-level animation. Both go through `useSyncExternalStore`, so a 60Hz value
  never re-renders the rest of the tree. The rAF loop only runs while playing.
- Queue, shuffle and repeat live in a pure reducer
  ([`src/state/playerReducer.ts`](src/state/playerReducer.ts)) with no DOM access,
  so the awkward cases (boundaries under each repeat mode, shuffle round-trips,
  reordering across the play cursor) are unit-tested directly.

## Licence and credits

This project is licensed under the **GNU AGPL-3.0-only** — see [LICENSE](LICENSE).

That is not a free choice: the player links
[Apple Music-like Lyrics](https://github.com/amll-dev/applemusic-like-lyrics)
by Steve-xmh and the AMLL contributors, which is AGPL-3.0-only, so the combined
work must be too. Practical consequences:

- The full source must stay available to anyone who uses the deployed site.
  That is what the "Source code (AGPL-3.0)" link in the sidebar is for — AGPL
  section 13 requires it for software conveyed over a network.
- Anyone who modifies and deploys this must publish their modified source under
  the same licence.

Third-party components:

| | |
|---|---|
| [`@applemusic-like-lyrics/*`](https://github.com/amll-dev/applemusic-like-lyrics) | AGPL-3.0-only — lyric player, background renderer, lyric parsers |
| [PixiJS v7](https://pixijs.com/) | MIT — WebGL renderer behind the fluid background |
| [React](https://react.dev/) | MIT |

Audio and artwork are **not** part of this repository; they are referenced by
URL from `public/tracks.json` and remain the property of their respective
owners.
