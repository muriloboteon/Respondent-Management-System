/* Phosphor icons (regular weight), as used by the Discuss design system. */
const PATHS = {
  search: <path d="M14.354 13.646 11.224 10.518A5.5 5.5 0 1 0 10.518 11.224l3.128 3.13a.5.5 0 0 0 .708-.708ZM2.5 7A4.5 4.5 0 1 1 7 11.5 4.505 4.505 0 0 1 2.5 7Z" fill="currentColor" />,
  sliders: <path d="M4 6.563V2.5a.5.5 0 0 0-1 0v4.063a2 2 0 0 0 0 3.874V13.5a.5.5 0 0 0 1 0v-3.063a2 2 0 0 0 0-3.874ZM3.5 9.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm5-5.937V2.5a.5.5 0 0 0-1 0v1.063a2 2 0 0 0 0 3.874V13.5a.5.5 0 0 0 1 0V7.437a2 2 0 0 0 0-3.874ZM8 6.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm6.5 4a2.004 2.004 0 0 0-1.5-1.938V2.5a.5.5 0 0 0-1 0v6.063a2 2 0 0 0 0 3.874V13.5a.5.5 0 0 0 1 0v-1.063a2.004 2.004 0 0 0 1.5-1.937Zm-2 1a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" fill="currentColor" />,
  dots: <path d="M8.75 8a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm3.5-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm-8.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" fill="currentColor" />,
  caretDown: <path d="m13.354 6.354-5 5a.5.5 0 0 1-.708 0l-5-5a.5.5 0 0 1 .708-.708L8 10.293l4.646-4.647a.5.5 0 0 1 .708.708Z" fill="currentColor" />,
  caretUp: <path d="M13.354 10.354a.5.5 0 0 1-.708 0L8 5.707l-4.646 4.647a.5.5 0 0 1-.708-.708l5-5a.5.5 0 0 1 .708 0l5 5a.5.5 0 0 1 0 .708Z" fill="currentColor" />,
  columns: (
    <>
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" />
      <path d="M6 2.5v11M10 2.5v11" stroke="currentColor" />
    </>
  ),
  x: <path d="M12.5 3.5l-9 9M3.5 3.5l9 9" stroke="currentColor" strokeLinecap="round" fill="none" />,
  lock: (
    <>
      <rect x="2.5" y="6" width="11" height="8" rx="1" fill="none" stroke="currentColor" />
      <path d="M5.5 6V4.5a2.5 2.5 0 0 1 5 0V6" fill="none" stroke="currentColor" />
      <circle cx="8" cy="10" r=".75" fill="currentColor" />
    </>
  ),
  clipboard: (
    <>
      <rect x="3" y="2.5" width="10" height="12" rx="1.5" fill="none" stroke="currentColor" />
      <rect x="5.5" y="1.5" width="5" height="2.5" rx=".75" fill="var(--surface-background, #fff)" stroke="currentColor" />
      <path d="M5.5 7.5h5M5.5 10h5M5.5 12.5h3" stroke="currentColor" strokeLinecap="round" fill="none" />
    </>
  ),
  plus: <path d="M8 3v10M3 8h10" stroke="currentColor" strokeLinecap="round" fill="none" />,
  download: <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M2.5 10v2.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  upload:<path d="M8 10.5V2.5M4.5 6 8 2.5 11.5 6M2.5 10v2.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  sparkle: (
    <>
      <path d="M6.5 2.5l1.1 3.4 3.4 1.1-3.4 1.1-1.1 3.4-1.1-3.4L2 7l3.4-1.1 1.1-3.4Z" fill="none" stroke="currentColor" strokeLinejoin="round" />
      <path d="M12 9.5l.55 1.45L14 11.5l-1.45.55L12 13.5l-.55-1.45L10 11.5l1.45-.55L12 9.5Z" fill="currentColor" />
    </>
  ),
  check: <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  star:<path d="M8 1.75l1.93 3.91 4.32.63-3.13 3.05.74 4.3L8 11.61l-3.86 2.03.74-4.3L1.75 6.29l4.32-.63L8 1.75Z" fill="currentColor" />,
  user: (
    <>
      <circle cx="8" cy="5.5" r="3" fill="none" stroke="currentColor" />
      <path d="M2.5 13.5a5.5 5.5 0 0 1 11 0" fill="none" stroke="currentColor" strokeLinecap="round" />
    </>
  ),
  pencil: <path d="M10.5 2.5l3 3-8 8H2.5v-3l8-8ZM8.5 4.5l3 3" fill="none" stroke="currentColor" strokeLinejoin="round" />,
  trash: <path d="M13.5 3H11v-.5A1.5 1.5 0 0 0 9.5 1h-3A1.5 1.5 0 0 0 5 2.5V3H2.5a.5.5 0 0 0 0 1H3v9a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4h.5a.5.5 0 0 0 0-1ZM6 2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V3H6v-.5ZM12 13H4V4h8v9ZM7 6.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 1 1 0Zm3 0v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 1 1 0Z" fill="currentColor" />,
}

export type IconName = keyof typeof PATHS

export function Icon({ name, small = false }: { name: IconName; small?: boolean }) {
  return (
    <svg className={small ? 'icon icon-sm' : 'icon'} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  )
}
