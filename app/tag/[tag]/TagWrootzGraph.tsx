'use client'

import { useMemo } from 'react'
import { formatWrootz } from '@/app/lib/constants'

interface DataPoint {
  block: number
  wrootz: number
}

interface TagWrootzGraphProps {
  data: DataPoint[]
}

export default function TagWrootzGraph({ data }: TagWrootzGraphProps) {
  const { pathData, linePath, maxWrootz, minBlock, maxBlock } = useMemo(() => {
    if (data.length < 2) {
      return { pathData: '', linePath: '', maxWrootz: 0, minBlock: 0, maxBlock: 0 }
    }

    const maxWrootz = Math.max(...data.map(d => d.wrootz), 1)
    const minBlock = data[0].block
    const maxBlock = data[data.length - 1].block
    const blockRange = maxBlock - minBlock || 1

    const width = 100
    const height = 100

    const points = data.map((d) => {
      const x = ((d.block - minBlock) / blockRange) * width
      const y = height - (d.wrootz / maxWrootz) * height
      return { x, y }
    })

    // Create area path
    const pointsStr = points.map(p => `${p.x},${p.y}`).join(' L ')
    const lastX = points[points.length - 1].x
    const firstX = points[0].x
    const pathData = `M ${firstX},${height} L ${pointsStr} L ${lastX},${height} Z`

    // Create line path
    const linePath = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`

    return { pathData, linePath, maxWrootz, minBlock, maxBlock }
  }, [data])

  if (data.length < 2) {
    return (
      <p className="text-[var(--muted)] text-center py-8">Not enough data for graph</p>
    )
  }

  return (
    <div>
      <div className="relative h-40 bg-[var(--background)] rounded-lg p-4">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          {/* Grid lines */}
          <line x1="0" y1="25" x2="100" y2="25" stroke="var(--card-border)" strokeWidth="0.5" strokeDasharray="2,2" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="var(--card-border)" strokeWidth="0.5" strokeDasharray="2,2" />
          <line x1="0" y1="75" x2="100" y2="75" stroke="var(--card-border)" strokeWidth="0.5" strokeDasharray="2,2" />

          {/* Area fill */}
          <path
            d={pathData}
            fill="var(--primary)"
            fillOpacity="0.2"
          />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Y-axis labels */}
        <div className="absolute left-1 top-2 bottom-2 flex flex-col justify-between text-[10px] text-[var(--muted)]">
          <span>{formatWrootz(maxWrootz)}</span>
          <span>{formatWrootz(maxWrootz / 2)}</span>
          <span>0</span>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between text-[10px] text-[var(--muted)] mt-1 px-4">
        <span>Block #{minBlock}</span>
        <span>Block #{maxBlock}</span>
      </div>
    </div>
  )
}
