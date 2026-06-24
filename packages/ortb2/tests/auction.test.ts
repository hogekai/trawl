import type { Bid } from "iab-openrtb/v26"
import { describe, expect, it } from "vitest"
import { auction, byDeal, byPrice } from "../src/index.js"

function bid(impid: string, price: number, dealid?: string): Bid {
	return {
		id: `${impid}-${price}`,
		impid,
		price,
		...(dealid != null ? { dealid } : {}),
	}
}

describe("byDeal (v2.6 dealid)", () => {
	it("prefers a deal bid over a higher-priced non-deal bid", () => {
		const result = byDeal()([bid("s1", 5.0), bid("s1", 1.0, "d1")])
		expect(result?.dealid).toBe("d1")
		expect(result?.price).toBe(1.0)
	})

	it("selects the highest price among deal bids", () => {
		const result = byDeal()([
			bid("s1", 1.0, "d1"),
			bid("s1", 3.0, "d2"),
			bid("s1", 10.0),
		])
		expect(result?.dealid).toBe("d2")
	})

	it("falls back to highest price when no deals", () => {
		expect(byDeal()([bid("s1", 1.0), bid("s1", 4.0)])?.price).toBe(4.0)
	})

	it("returns null for an empty array", () => {
		expect(byDeal()([])).toBeNull()
	})
})

describe("byPrice + auction", () => {
	it("selects the highest price per impid", () => {
		const bids = new Map<string, Bid[]>([
			["s1", [bid("s1", 1.0), bid("s1", 3.0)]],
			["s2", [bid("s2", 2.0)]],
		])
		const winners = auction(bids, byPrice())
		expect(winners.get("s1")?.price).toBe(3.0)
		expect(winners.get("s2")?.price).toBe(2.0)
	})
})
