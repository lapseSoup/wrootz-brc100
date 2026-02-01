# Future Features - Wrootz Mainnet

## On-Chain Covenant Enforcement (Option 1)

**Status:** Backburner - implement after MVP proves concept

### The Problem
When a post is listed for sale, lockers add wrootz expecting to share in the sale proceeds. With ordinals freely transferable, the owner could transfer the ordinal outside the app, screwing over lockers.

### The Solution: Covenant-Locked Ordinals
When listing a post for sale, the ordinal would be locked in a Bitcoin script (covenant) that enforces:

1. **Sale Price Enforcement** - Ordinal can only be spent if the sale price (in sats) is paid
2. **Automatic Distribution** - Script automatically splits payment:
   - X% to lockers (proportional to their wrootz share)
   - Remaining % to seller
3. **Cancel Conditions** - Owner can only cancel if no locks were added after listing

### Technical Approach

#### Using sCrypt (BSV Smart Contracts)
```typescript
// Pseudocode for covenant
class WrootzSale extends SmartContract {
  @prop() seller: PubKey
  @prop() salePrice: bigint
  @prop() lockerShares: Map<PubKey, bigint> // pubkey -> share percentage

  @method()
  public buy(buyerSig: Sig, buyerPubKey: PubKey) {
    // Verify payment amount
    assert(this.ctx.utxo.value >= this.salePrice)

    // Distribute to lockers
    for (const [locker, share] of this.lockerShares) {
      const amount = this.salePrice * share / 100n
      // Output to locker
    }

    // Remaining to seller
    // Transfer ordinal to buyer
  }

  @method()
  public cancel(sellerSig: Sig) {
    // Only if no post-listing locks
    assert(this.lockerShares.size == 0)
    // Return ordinal to seller
  }
}
```

#### Challenges to Solve
1. **Dynamic locker list** - Lockers can be added after listing, need updateable state
2. **UTXO model** - Each state change requires new transaction
3. **Gas costs** - Complex scripts cost more
4. **Testing** - Need thorough testing before mainnet

### Resources
- [sCrypt Documentation](https://docs.scrypt.io/)
- [BSV Script Reference](https://wiki.bitcoinsv.io/index.php/Script)
- [1Sat Ordinals Spec](https://docs.1satordinals.com/)

### When to Implement
- After MVP launch and user validation
- When there's evidence of bad actors gaming the system
- When we have resources for proper security audit

---

## Other Future Ideas

### Nested Locks
Allow locks on locks - "I believe in this locker's judgment"

### Tag Staking
Lock BSV on a tag itself, not just posts with that tag

### Prediction Markets
Lock BSV on outcomes, wrootz decay based on resolution

### Cross-Platform Ordinal Display
Show Wrootz posts in other ordinal marketplaces/explorers
