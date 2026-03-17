import type { Bid } from "iab-openrtb/v30"
import type { AuctionStrategy } from "./types.js"

export function auction(
	bids: Map<string, Bid[]>,
	strategy: AuctionStrategy,
): Map<string, Bid> {
	const winners = new Map<string, Bid>()
	for (const [key, bidList] of bids) {
		const winner = strategy(bidList)
		if (winner !== null) {
			winners.set(key, winner)
		}
	}
	return winners
}

export function byPrice(): AuctionStrategy {
	return (bids) => {
		if (bids.length === 0) return null
		let best = bids[0]!
		for (let i = 1; i < bids.length; i++) {
			if (bids[i]!.price > best.price) {
				best = bids[i]!
			}
		}
		return best
	}
}

export function byDeal(): AuctionStrategy {
	return (bids) => {
		if (bids.length === 0) return null
		const dealBids = bids.filter((b) => b.deal != null)
		const pool = dealBids.length > 0 ? dealBids : bids
		let best = pool[0]!
		for (let i = 1; i < pool.length; i++) {
			if (pool[i]!.price > best.price) {
				best = pool[i]!
			}
		}
		return best
	}
}
