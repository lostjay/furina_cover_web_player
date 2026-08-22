/** Inline SF-Symbols-flavoured glyphs. Sized by the `size` prop, coloured by CSS. */
type P = { size?: number }

const svg = (d: string, filled = true) =>
  function Icon({ size = 18 }: P) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={filled ? 'currentColor' : 'none'}
        stroke={filled ? 'none' : 'currentColor'}
        strokeWidth={filled ? undefined : 1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={d} />
      </svg>
    )
  }

export const PlayIcon = svg('M8 5.14v13.72a1 1 0 0 0 1.53.85l10.72-6.86a1 1 0 0 0 0-1.7L9.53 4.29A1 1 0 0 0 8 5.14Z')
export const PauseIcon = svg('M7 4h3.5v16H7zM13.5 4H17v16h-3.5z')
export const NextIcon = svg('M6 5.2v13.6a1 1 0 0 0 1.54.84l9.2-6.8a1 1 0 0 0 0-1.68l-9.2-6.8A1 1 0 0 0 6 5.2ZM18 4h2.2v16H18z')
export const PrevIcon = svg('M18 5.2v13.6a1 1 0 0 1-1.54.84l-9.2-6.8a1 1 0 0 1 0-1.68l9.2-6.8A1 1 0 0 1 18 5.2ZM3.8 4H6v16H3.8z')
export const ShuffleIcon = svg('M16 3h5v5M21 3l-7.5 7.5M8 21H3v-5M3 21l7.5-7.5M16 21h5v-5M21 21l-6-6M3 3h5l3.5 3.5', false)
export const RepeatIcon = svg('M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3', false)
export const SearchIcon = svg('M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16ZM21 21l-4.35-4.35', false)
export const QueueIcon = svg('M3 6h13M3 12h13M3 18h9M21 8v10.5a2 2 0 1 1-1.5-1.94V8z', false)
export const LyricsIcon = svg('M4 5h16M4 10h11M4 15h16M4 20h8', false)
export const ChevronDownIcon = svg('M6 9l6 6 6-6', false)
export const CloseIcon = svg('M18 6 6 18M6 6l12 12', false)
export const SunIcon = svg('M12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10ZM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4', false)
export const MoonIcon = svg('M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z', false)
export const VolumeIcon = svg('M11 5 6 9H2v6h4l5 4V5ZM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13', false)
export const MuteIcon = svg('M11 5 6 9H2v6h4l5 4V5ZM22 9l-6 6M16 9l6 6', false)
export const MusicIcon = svg('M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z', false)
export const PlusIcon = svg('M12 5v14M5 12h14', false)
export const TrashIcon = svg('M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6', false)
