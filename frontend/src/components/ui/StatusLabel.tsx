import type { ReactNode } from 'react'

export function StatusLabel({ proposal = false, children }: { proposal?: boolean; children: ReactNode }) {
  return <span className={proposal ? 'proposal-label' : 'demo-label'}>{children}</span>
}
