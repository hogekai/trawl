import { describe, it, expect } from "vitest"
import { auction, byPrice, byDeal } from "../src/auction.js"
import type { Bid } from "iab-openrtb/v30"

function bid(item: string, price: number, deal?: string): Bid {
	return { item, price, ...(deal != null ? { deal } : {}) }
}

describe("auction", () => {
	it("selects winner per impId using strategy", () => {
		const bids = new Map<string, Bid[]>([
			["imp-1", [bid("imp-1", 1.0), bid("imp-1", 3.0)]],
			["imp-2", [bid("imp-2", 2.0)]],
		])
		const winners = auction(bids, byPrice())
		expect(winners.size).toBe(2)
		expect(winners.get("imp-1")!.price).toBe(3.0)
		expect(winners.get("imp-2")!.price).toBe(2.0)
	})

	it("omits impId when strategy returns null", () => {
		const bids = new Map<string, Bid[]>([
			["imp-1", [bid("imp-1", 1.0)]],
			["imp-2", []],
		])
		const winners = auction(bids, byPrice())
		expect(winners.size).toBe(1)
		expect(winners.has("imp-2")).toBe(false)
	})

	it("returns empty Map for empty input", () => {
		const winners = auction(new Map(), byPrice())
		expect(winners.size).toBe(0)
	})

	it("passes empty Bid[] to strategy", () => {
		const bids = new Map<string, Bid[]>([["imp-1", []]])
		const winners = auction(bids, (b) => (b.length > 0 ? b[0]! : null))
		expect(winners.size).toBe(0)
	})
})

describe("byPrice", () => {
	it("selects highest price", () => {
		const strategy = byPrice()
		const result = strategy([
			bid("imp-1", 1.0),
			bid("imp-1", 3.0),
			bid("imp-1", 2.0),
		])
		expect(result!.price).toBe(3.0)
	})

	it("selects first on tie", () => {
		const strategy = byPrice()
		const b1 = bid("imp-1", 2.0)
		const b2 = bid("imp-1", 2.0)
		b1.id = "first"
		b2.id = "second"
		const result = strategy([b1, b2])
		expect(result!.id).toBe("first")
	})

	it("returns single bid", () => {
		const result = byPrice()([bid("imp-1", 5.0)])
		expect(result!.price).toBe(5.0)
	})

	it("returns null for empty array", () => {
		expect(byPrice()([])).toBeNull()
	})
})

describe("byDeal", () => {
	it("prefers deal bid over higher-price non-deal", () => {
		const result = byDeal()([
			bid("imp-1", 5.0),        // no deal, higher price
			bid("imp-1", 1.0, "d1"),  // deal, lower price
		])
		expect(result!.deal).toBe("d1")
		expect(result!.price).toBe(1.0)
	})

	it("selects highest price among deal bids", () => {
		const result = byDeal()([
			bid("imp-1", 1.0, "d1"),
			bid("imp-1", 3.0, "d2"),
			bid("imp-1", 10.0),
		])
		expect(result!.deal).toBe("d2")
		expect(result!.price).toBe(3.0)
	})

	it("falls back to highest price when no deals", () => {
		const result = byDeal()([
			bid("imp-1", 1.0),
			bid("imp-1", 4.0),
		])
		expect(result!.price).toBe(4.0)
	})

	it("returns null for empty array", () => {
		expect(byDeal()([])).toBeNull()
	})
})
