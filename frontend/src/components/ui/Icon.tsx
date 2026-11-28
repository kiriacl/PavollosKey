import type { ReactNode } from 'react'

const drawings = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.6" />
      <rect x="14" y="3" width="7" height="7" rx="1.6" />
      <rect x="3" y="14" width="7" height="7" rx="1.6" />
      <rect x="14" y="14" width="7" height="7" rx="1.6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2m0-15a3 3 0 0 1 0 6m3 3a5 5 0 0 1 3 4.6V20" />
    </>
  ),
  requests: (
    <>
      <path d="M20 13a3 3 0 0 1-3 3H9l-5 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
      <path d="M8 8h8m-8 4h5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M7 3v4m10-4v4M3 10h18m-13 4h2m4 0h2m-8 3h2" />
    </>
  ),
  quote: (
    <>
      <path d="M6 3h12v18l-3-1.8-3 1.8-3-1.8L6 21zM9 7h6m-6 4h6m-6 4h3" />
    </>
  ),
  tools: (
    <>
      <path d="m14.5 6.5 3 3 3.1-3.1a6 6 0 0 1-7.8 7.8l-5.9 5.9a2.1 2.1 0 0 1-3-3l5.9-5.9a6 6 0 0 1 7.8-7.8z" />
    </>
  ),
  box: (
    <>
      <path d="m12 2.8 8.7 4.9v8.9L12 21.5l-8.7-4.9V7.7zM3.4 7.8l8.6 5 8.6-5M12 12.8v8.7M8 5l8.5 5" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 2.7-6.4L3 8m0-5v5h5m4-1v5l3.5 2" />
    </>
  ),
  settings: (
    <>
      <path d="m9 3 .8-1h4.4l.8 2.7 2 .9 2.6-.6 2.1 3.6-1.8 2v2.6l1.8 2-2.1 3.6-2.6-.6-2 .9-.8 2.6H9.8L9 19.1l-2-.9-2.6.6-2.1-3.6 1.8-2v-2.6l-1.8-2L4.4 5 7 5.6l2-.9z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  cube: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9zm-8 4.5 8 4.5 8-4.5M12 12v9" />
    </>
  ),
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 4.5 4.5" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  pause: (
    <>
      <path d="M8 5v14m8-14v14" strokeWidth="3.3" />
    </>
  ),
  play: <path d="m7 4 13 8-13 8z" />,
  shop: (
    <>
      <path d="M3 10 5 4h14l2 6M4 13v7h16v-7M3 10h18v1a3 3 0 0 1-4.5 2.6A3 3 0 0 1 12 13a3 3 0 0 1-4.5.6A3 3 0 0 1 3 11zM9 20v-4h4v4" />
    </>
  ),
  home: (
    <>
      <path d="m3 10 9-7 9 7M5 9v12h14V9m-10 12v-7h6v7" />
    </>
  ),
  panel: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M9 4v16" />
    </>
  ),
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof drawings

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {drawings[name]}
    </svg>
  )
}
