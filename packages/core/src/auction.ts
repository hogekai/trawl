import type { AuctionStrategy } from "./types.js"

export function auction<TBid>(
	bids: Map<string, TBid[]>,
	strategy: AuctionStrategy<TBid>,
): Map<string, TBid> {
	const winners = new Map<string, TBid>()
	for (const [key, bidList] of bids) {
		const winner = strategy(bidList)
		if (winner !== null) {
			winners.set(key, winner)
		}
	}
	return winners
}

/** Highest `price` wins; first bid wins on a tie. Shared by every version. */
export function pickHighestPrice<TBid extends { price: number }>(
	bids: TBid[],
): TBid | null {
	if (bids.length === 0) return null
	let best = bids[0]!
	for (let i = 1; i < bids.length; i++) {
		if (bids[i]!.price > best.price) {
			best = bids[i]!
		}
	}
	return best
}

export function byPrice<
	TBid extends { price: number },
>(): AuctionStrategy<TBid> {
	return (bids) => pickHighestPrice(bids)
}
