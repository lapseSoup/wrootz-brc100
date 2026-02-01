# Wrootz Design Issues

Open design questions and potential attack vectors to address.

---

## Issue #1: Griefing via Small Locks

**Status:** Open

**Problem:** A malicious user could lock a tiny amount (e.g., 1 sat) for the maximum duration (1 year) on a post. This would freeze the owner's ability to cancel or modify the sale listing for the entire lock duration, effectively griefing the asset.

**Attack scenario:**
1. Alice lists her post for 1 BSV with 50% locker share
2. Griefer locks 1 sat for 1 year
3. Alice cannot cancel the sale or change the price for an entire year
4. Alice's asset is effectively frozen

**Potential solutions:**

### Option A: Minimum lock amount
- Set a floor (e.g., 10,000 sats minimum)
- Simple but doesn't fully solve it - griefing just costs more

### Option B: Owner can buy out locks
- Owner pays lockers their expected profit share to clear their locks
- Fair but complex to implement

### Option C: Minimum wrootz threshold
- Listing only becomes "frozen" if total wrootz exceeds some threshold
- Small grief locks don't trigger the protection
- Creates gray area where small lockers aren't protected

### Option D: Grace period
- Owner can cancel/change within first X blocks after listing
- Gives time to fix mistakes, but lockers in that window have no protection

### Option E: Locks must match minimum % of sale price
- E.g., total locked amount must be ≥ 1% of sale price to freeze the listing
- If you list at 1 BSV, need 0.01 BSV locked to trigger protection
- Scales with the value being protected

**Recommendation:** Option E seems most balanced - creates a natural threshold where the freeze only kicks in when there's meaningful skin in the game.

---

## Issue #2: [Template for future issues]

**Status:** Open

**Problem:** [Description]

**Attack scenario:** [How the attack works]

**Potential solutions:** [Options]

**Recommendation:** [Preferred approach]
