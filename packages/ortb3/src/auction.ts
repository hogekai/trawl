import { auction, byPrice, pickHighestPrice } from "@trawl/core"
import type { AuctionStrategy } from "./types.js"

export { auction, byPrice }

/** Prefer bids with a deal; among the chosen pool, highest price wins. */
export function byDeal(): AuctionStrategy {
	return (bids) => {
		if (bids.length === 0) return null
		const dealBids = bids.filter((b) => b.deal != null)
		const pool = dealBids.length > 0 ? dealBids : bids
		return pickHighestPrice(pool)
	}
}
