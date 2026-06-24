import { describe, expect, it } from "vitest"
import { auction, byPrice, pickHighestPrice } from "../src/auction.js"

interface Bid {
	id?: string
	price: number
}

function bid(price: number, id?: string): Bid {
	return id != null ? { id, price } : { price }
}

describe("auction", () => {
	it("selects a winner per key using the strategy", () => {
		const bids = new Map<string, Bid[]>([
			["imp-1", [bid(1.0), bid(3.0)]],
			["imp-2", [bid(2.0)]],
		])
		const winners = auction(bids, byPrice())
		expect(winners.size).toBe(2)
		expect(winners.get("imp-1")?.price).toBe(3.0)
		expect(winners.get("imp-2")?.price).toBe(2.0)
	})

	it("omits a key when the strategy returns null", () => {
		const bids = new Map<string, Bid[]>([
			["imp-1", [bid(1.0)]],
			["imp-2", []],
		])
		const winners = auction(bids, byPrice())
		expect(winners.size).toBe(1)
		expect(winners.has("imp-2")).toBe(false)
	})

	it("returns an empty Map for empty input", () => {
		const winners = auction(new Map<string, Bid[]>(), byPrice())
		expect(winners.size).toBe(0)
	})
})

describe("byPrice / pickHighestPrice", () => {
	it("selects the highest price", () => {
		expect(byPrice()([bid(1.0), bid(3.0), bid(2.0)])?.price).toBe(3.0)
	})

	it("selects the first bid on a tie", () => {
		const result = byPrice()([bid(2.0, "first"), bid(2.0, "second")])
		expect(result?.id).toBe("first")
	})

	it("returns the single bid", () => {
		expect(pickHighestPrice([bid(5.0)])?.price).toBe(5.0)
	})

	it("returns null for an empty array", () => {
		expect(pickHighestPrice<Bid>([])).toBeNull()
	})
})
