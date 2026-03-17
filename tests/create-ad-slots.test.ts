import { describe, it, expect } from "vitest"
import { createAdSlots, imp, banner, video } from "../src/index.js"
import type { Item } from "iab-openrtb/v30"

describe("createAdSlots", () => {
	it("returns an AdSlots object with use, demand, and bid methods", () => {
		const ads = createAdSlots(
			imp("header", banner([728, 90])),
		)
		expect(ads).toHaveProperty("use")
		expect(ads).toHaveProperty("demand")
		expect(ads).toHaveProperty("bid")
		expect(typeof ads.use).toBe("function")
		expect(typeof ads.demand).toBe("function")
		expect(typeof ads.bid).toBe("function")
	})

	it("accepts raw OpenRTB Item objects", () => {
		const rawItem: Item = {
			id: "raw-1",
			spec: {
				display: { displayfmt: [{ w: 300, h: 250 }] },
			},
		}
		const ads = createAdSlots(rawItem)
		expect(ads).toHaveProperty("bid")
	})

	it("accepts a mix of helper-generated and raw items", () => {
		const rawItem: Item = {
			id: "raw-1",
			spec: { video: { mime: ["video/mp4"] } },
		}
		const ads = createAdSlots(
			imp("header", banner([728, 90])),
			rawItem,
		)
		expect(ads).toHaveProperty("bid")
	})

	it("accepts zero items", () => {
		const ads = createAdSlots()
		expect(ads).toHaveProperty("bid")
	})

	it("throws on duplicate imp ids", () => {
		expect(() =>
			createAdSlots(
				imp("dup", banner([728, 90])),
				imp("dup", banner([300, 250])),
			),
		).toThrow(/Duplicate imp id: "dup"/)
	})

	describe("use()", () => {
		it("registers a global plugin without throwing", () => {
			const ads = createAdSlots(imp("a", banner([728, 90])))
			expect(() => {
				ads.use({ name: "test-plugin" })
			}).not.toThrow()
		})
	})

	describe("demand()", () => {
		it("returns a DemandHandle with a with() method", () => {
			const ads = createAdSlots(imp("a", banner([728, 90])))
			const handle = ads.demand({
				name: "test-demand",
				fetchBids: async () => [],
			})
			expect(handle).toHaveProperty("with")
			expect(typeof handle.with).toBe("function")
		})

		it("supports method chaining with with()", () => {
			const ads = createAdSlots(imp("a", banner([728, 90])))
			const handle = ads.demand({
				name: "test-demand",
				fetchBids: async () => [],
			})
			const result = handle
				.with({ name: "plugin-1" })
				.with({ name: "plugin-2" })
			expect(result).toHaveProperty("with")
		})
	})

	describe("bid()", () => {
		it("returns a BidResult stub", async () => {
			const ads = createAdSlots(imp("a", banner([728, 90])))
			const result = await ads.bid()
			expect(result).toHaveProperty("requestId")
			expect(result).toHaveProperty("bids")
			expect(result).toHaveProperty("errors")
			expect(result.bids).toBeInstanceOf(Map)
			expect(result.errors).toEqual([])
		})
	})
})
