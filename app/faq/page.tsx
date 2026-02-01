import Link from 'next/link'

export default function FAQPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="card">
        <h1 className="text-2xl font-bold mb-6">How Wrootz Works</h1>

        {/* Quick Summary */}
        <div className="p-4 rounded-xl bg-[var(--primary)]/10 border border-[var(--primary)]/20 mb-8">
          <h2 className="font-semibold text-[var(--primary)] mb-3">Quick Summary</h2>
          <div className="space-y-2 text-sm text-[var(--foreground-secondary)]">
            <p><strong>Wrootz</strong> = sats locked × blocks. More sats + longer duration = more wrootz = bigger profit share.</p>
            <p><strong>How to participate:</strong> Lock BSV on content you believe in. When it sells, you get a share of the sale based on your wrootz %.</p>
            <p><strong>Lock expiry:</strong> Your BSV is returned to your balance. Wrootz decay to zero over the lock duration.</p>
          </div>
        </div>

        <div className="space-y-8">
          {/* What is Wrootz */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-[var(--primary)]">What is Wrootz?</h2>
            <p className="text-[var(--foreground-secondary)] leading-relaxed">
              Wrootz is a content curation platform where users lock BSV (Bitcoin SV) on posts they believe in.
              By locking sats (the smallest unit of BSV), you generate &quot;wrootz&quot; that get attached to the content -
              a measure of your commitment to that post. When content sells, wrootz holders receive a share of the
              profits proportional to their wrootz percentage.
            </p>
          </section>

          {/* How Wrootz is Calculated */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-[var(--primary)]">How is Wrootz Calculated?</h2>
            <div className="p-4 rounded-lg bg-[var(--surface-2)] mb-4">
              <code className="text-[var(--accent)] font-mono">
                wrootz = (sats locked × duration in blocks) ÷ 52,560
              </code>
            </div>
            <p className="text-[var(--foreground-secondary)] leading-relaxed mb-3">
              The formula rewards both the amount you lock and how long you lock it. 52,560 is the normalization
              factor (approximately one year of blocks at 144 blocks per day).
            </p>
            <div className="text-sm text-[var(--foreground-muted)] space-y-1">
              <p><strong>Example:</strong> Locking 100,000 sats for 1 day (144 blocks):</p>
              <p className="pl-4">100,000 × 144 ÷ 52,560 = <span className="text-[var(--accent)] font-medium">274 wrootz</span></p>
            </div>
          </section>

          {/* Wrootz Decay */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-[var(--primary)]">Why Does Wrootz Decay?</h2>
            <p className="text-[var(--foreground-secondary)] leading-relaxed mb-3">
              Your wrootz decreases linearly as time passes. This reflects the decreasing commitment as your
              lock approaches expiration. When your lock expires, your wrootz reaches zero.
            </p>
            <p className="text-[var(--foreground-secondary)] leading-relaxed">
              This creates a fair system where early supporters who lock for longer periods have more influence,
              while the value naturally transitions as locks expire and new ones are created.
            </p>
          </section>

          {/* Profit Sharing */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-[var(--primary)]">How Does Profit Sharing Work?</h2>
            <p className="text-[var(--foreground-secondary)] leading-relaxed mb-3">
              When content is sold, the sale price is split:
            </p>
            <ul className="list-disc list-inside text-[var(--foreground-secondary)] space-y-2 mb-3">
              <li><strong>Owner&apos;s share:</strong> Goes to the content owner (100% - locker share %)</li>
              <li><strong>Locker share:</strong> Distributed among all active lockers based on their wrootz percentage</li>
            </ul>
            <div className="text-sm text-[var(--foreground-muted)] p-3 rounded-lg bg-[var(--surface-2)]">
              <p><strong>Example:</strong> A post sells for 1,000,000 sats with 10% locker share.</p>
              <p>If you have 20% of the total wrootz, you receive:</p>
              <p className="pl-4">1,000,000 × 10% × 20% = <span className="text-[var(--accent)] font-medium">20,000 sats</span></p>
            </div>
          </section>

          {/* Tags */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-[var(--primary)]">What Are Tags?</h2>
            <p className="text-[var(--foreground-secondary)] leading-relaxed mb-3">
              When you lock sats, you can add a single tag to describe why you&apos;re supporting the content
              (e.g., &quot;quality&quot;, &quot;funny&quot;, &quot;informative&quot;). Tags help categorize content and allow others
              to discover posts based on community curation.
            </p>
            <p className="text-[var(--foreground-secondary)] leading-relaxed">
              The wrootz attached to each tag determines its prominence. Popular tags with more wrootz
              appear in the trending sidebar.
            </p>
          </section>

          {/* Blocks */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-[var(--primary)]">What Are Blocks?</h2>
            <p className="text-[var(--foreground-secondary)] leading-relaxed mb-3">
              Wrootz uses a block-based time system similar to Bitcoin:
            </p>
            <ul className="list-disc list-inside text-[var(--foreground-secondary)] space-y-1">
              <li>1 block = 10 minutes</li>
              <li>6 blocks = 1 hour</li>
              <li>144 blocks = 1 day</li>
              <li>1,008 blocks = 1 week</li>
              <li>4,320 blocks = 1 month</li>
              <li>52,560 blocks = 1 year (maximum lock duration)</li>
            </ul>
          </section>

          {/* Content Ownership */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-[var(--primary)]">How Does Content Ownership Work?</h2>
            <p className="text-[var(--foreground-secondary)] leading-relaxed mb-3">
              Every post has a <strong>creator</strong> (who made it) and an <strong>owner</strong> (who currently owns it).
              Initially, these are the same person. When content is sold, ownership transfers to the buyer.
            </p>
            <p className="text-[var(--foreground-secondary)] leading-relaxed">
              Only the owner can list content for sale or cancel a sale. The locker share percentage is set
              by the creator and cannot be changed.
            </p>
          </section>

          {/* Getting Started */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-[var(--primary)]">Getting Started</h2>
            <ol className="list-decimal list-inside text-[var(--foreground-secondary)] space-y-2">
              <li>Create an account - you&apos;ll receive 1 BSV (100,000,000 sats) to start</li>
              <li>Browse posts and find content you believe in</li>
              <li>Lock sats on posts to add wrootz and support creators</li>
              <li>Create your own posts and set a locker share to incentivize curation</li>
              <li>Receive profits when content you&apos;ve locked on sells</li>
            </ol>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-[var(--border)]">
          <Link href="/" className="btn btn-primary">
            Start Exploring
          </Link>
        </div>
      </div>
    </div>
  )
}
