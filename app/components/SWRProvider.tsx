'use client'

import { SWRConfig } from 'swr'
import { swrConfig } from '@/app/hooks/useAppData'

export default function SWRProvider({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={swrConfig}>{children}</SWRConfig>
}
