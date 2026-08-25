/**
 * Labels that depend on state rather than being fixed strings.
 *
 * The UI is Chinese throughout and strings live inline in the components that
 * use them; only the ones that have to be *computed* are gathered here, so the
 * two transports and the theme button cannot drift apart in their wording.
 */

import type { RepeatMode } from '../state/playerReducer'

const REPEAT: Record<RepeatMode, string> = {
  off: '循环播放：关闭',
  all: '循环播放：列表循环',
  one: '循环播放：单曲循环',
}

export function repeatLabel(mode: RepeatMode): string {
  return REPEAT[mode]
}

const THEME: Record<'light' | 'dark' | 'system', string> = {
  light: '外观：浅色',
  dark: '外观：深色',
  system: '外观：跟随系统',
}

export function themeLabel(theme: 'light' | 'dark' | 'system'): string {
  return THEME[theme]
}

/** "3 首歌曲" — Chinese has no plural form, so this is just a measure word. */
export function songCount(n: number): string {
  return `${n} 首歌曲`
}
