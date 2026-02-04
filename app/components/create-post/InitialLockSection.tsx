'use client'

import { LOCK_DURATION_PRESETS, calculateWrootzFromSats } from '@/app/lib/constants'
import TagInput from '@/app/components/TagInput'
import SatsInput from '@/app/components/SatsInput'

interface InitialLockSectionProps {
  addInitialLock: boolean
  setAddInitialLock: (add: boolean) => void
  lockAmountSats: string
  setLockAmountSats: (amount: string) => void
  lockDuration: number
  setLockDuration: (duration: number) => void
  lockTag: string
  setLockTag: (tag: string) => void
}

export default function InitialLockSection({
  addInitialLock,
  setAddInitialLock,
  lockAmountSats,
  setLockAmountSats,
  lockDuration,
  setLockDuration,
  lockTag,
  setLockTag
}: InitialLockSectionProps) {
  // Calculate wrootz preview for initial lock
  const lockSatsNum = parseInt(lockAmountSats) || 0
  const wrootzPreview = lockSatsNum > 0 && lockDuration > 0
    ? calculateWrootzFromSats(lockSatsNum, lockDuration).toFixed(2)
    : '0'

  return (
    <div className="border border-[var(--card-border)] rounded-lg p-4">
      <label className="flex items-center gap-2 cursor-pointer mb-3">
        <input
          type="checkbox"
          checked={addInitialLock}
          onChange={(e) => setAddInitialLock(e.target.checked)}
          className="rounded accent-[var(--primary)]"
          aria-describedby="lock-description"
        />
        <span className="font-medium">Lock BSV on this post (optional)</span>
      </label>
      <p id="lock-description" className="sr-only">
        Optionally lock BSV to boost this post&apos;s visibility
      </p>

      {addInitialLock && (
        <div className="space-y-3 pt-2 border-t border-[var(--card-border)]">
          <div>
            <label className="label text-sm" htmlFor="lock-amount">Amount (sats)</label>
            <SatsInput
              value={lockAmountSats}
              onChange={setLockAmountSats}
              placeholder="10,000"
            />
            <p className="text-xs text-[var(--muted)] mt-1">
              1 BSV = 100,000,000 sats
            </p>
          </div>

          <div>
            <label className="label text-sm" id="lock-duration-label">Lock Duration</label>
            <div
              className="grid grid-cols-3 gap-2"
              role="group"
              aria-labelledby="lock-duration-label"
            >
              {LOCK_DURATION_PRESETS.slice(0, 6).map((preset) => (
                <button
                  key={preset.blocks}
                  type="button"
                  onClick={() => setLockDuration(preset.blocks)}
                  className={`p-2 rounded-lg text-xs border transition-colors ${
                    lockDuration === preset.blocks
                      ? 'border-[var(--primary)] text-[var(--primary)] font-semibold'
                      : 'border-[var(--card-border)] hover:border-[var(--secondary)]'
                  }`}
                  style={lockDuration === preset.blocks ? { backgroundColor: 'rgba(59, 130, 246, 0.15)' } : {}}
                  aria-pressed={lockDuration === preset.blocks}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label text-sm" htmlFor="lock-tag">Tag (optional)</label>
            <TagInput
              value={lockTag}
              onChange={setLockTag}
              placeholder="e.g., quality, art, meme"
            />
          </div>

          <div
            className="p-3 rounded-lg text-center bg-[var(--accent)]"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="text-xs text-white font-medium mb-1 opacity-90">You will generate</div>
            <div className="text-2xl font-bold text-white">{wrootzPreview}</div>
            <div className="text-sm text-white opacity-90">wrootz</div>
          </div>
        </div>
      )}
    </div>
  )
}

export { InitialLockSection }
