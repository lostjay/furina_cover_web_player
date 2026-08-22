import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { PlayerProvider } from './state/PlayerProvider'
// AMLL ships its own stylesheet; the lyric player is unstyled without it.
import '@applemusic-like-lyrics/core/style.css'
import './styles/global.css'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root not found')

createRoot(rootEl).render(
  <StrictMode>
    <PlayerProvider>
      <App />
    </PlayerProvider>
  </StrictMode>,
)
