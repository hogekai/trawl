import { describe, expect, it } from "vitest"
import { banner, imp, native, video } from "../src/index.js"

describe("imp()", () => {
	it("creates an Item with id and spec", () => {
		const item = imp("slot-1", banner([728, 90]))
		expect(item.id).toBe("slot-1")
		expect(item.spec).toBeDefined()
		expect(item.spec.display?.displayfmt).toEqual([{ w: 728, h: 90 }])
	})

	it("merges multiple placements for multi-format", () => {
		const item = imp(
			"multi",
			banner([300, 250]),
			video({ mimes: ["video/mp4"] }),
		)
		expect(item.spec.display?.displayfmt).toEqual([{ w: 300, h: 250 }])
		expect(item.spec.video?.mime).toEqual(["video/mp4"])
	})
})

describe("banner()", () => {
	it("creates displayfmt with a single size", () => {
		const result = banner([300, 250])
		expect(result.display?.displayfmt).toEqual([{ w: 300, h: 250 }])
	})

	it("creates displayfmt with multiple sizes", () => {
		const result = banner([728, 90], [970, 250], [320, 50])
		expect(result.display?.displayfmt).toHaveLength(3)
		expect(result.display?.displayfmt).toEqual([
			{ w: 728, h: 90 },
			{ w: 970, h: 250 },
			{ w: 320, h: 50 },
		])
	})

	it("throws when called with no sizes", () => {
		expect(() => banner()).toThrow("banner() requires at least one size")
	})
})

describe("video()", () => {
	it("maps mimes to mime field", () => {
		const result = video({ mimes: ["video/mp4", "video/webm"] })
		expect(result.video?.mime).toEqual(["video/mp4", "video/webm"])
	})

	it("passes through additional parameters", () => {
		const result = video({ mimes: ["video/mp4"], maxdur: 30, mindur: 5 })
		expect(result.video?.mime).toEqual(["video/mp4"])
		expect(result.video?.maxdur).toBe(30)
		expect(result.video?.mindur).toBe(5)
	})
})

describe("native()", () => {
	it("creates assets for title and image", () => {
		const result = native({ title: 90, image: 3 })
		const assets = result.display?.nativefmt?.asset
		expect(assets).toHaveLength(2)
		expect(assets?.[0]).toEqual({ id: 0, title: { len: 90 } })
		expect(assets?.[1]).toEqual({ id: 1, img: { type: 3 } })
	})

	it("creates a single asset for title only", () => {
		const result = native({ title: 25 })
		const assets = result.display?.nativefmt?.asset
		expect(assets).toHaveLength(1)
		expect(assets?.[0]).toEqual({ id: 0, title: { len: 25 } })
	})
})
