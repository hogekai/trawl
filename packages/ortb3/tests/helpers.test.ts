import { describe, expect, it } from "vitest"
import { banner, item, native, video } from "../src/index.js"

describe("item()", () => {
	it("creates an Item with id and spec", () => {
		const i = item("slot-1", banner([[728, 90]]))
		expect(i.id).toBe("slot-1")
		expect(i.spec).toBeDefined()
		expect(i.spec.display?.displayfmt).toEqual([{ w: 728, h: 90 }])
	})

	it("merges multiple placements for multi-format", () => {
		const i = item("multi", banner([[300, 250]]), video({ mimes: ["video/mp4"] }))
		expect(i.spec.display?.displayfmt).toEqual([{ w: 300, h: 250 }])
		expect(i.spec.video?.mime).toEqual(["video/mp4"])
	})

	it("deep merges display when banner and native are combined", () => {
		const i = item(
			"combo",
			banner([[300, 250]]),
			native([{ title: { len: 90 } }]),
		)
		expect(i.spec.display?.displayfmt).toEqual([{ w: 300, h: 250 }])
		expect(i.spec.display?.nativefmt?.asset).toEqual([
			{ id: 0, title: { len: 90 } },
		])
	})
})

describe("banner()", () => {
	it("creates displayfmt with a single size", () => {
		const result = banner([[300, 250]])
		expect(result.display?.displayfmt).toEqual([{ w: 300, h: 250 }])
	})

	it("creates displayfmt with multiple sizes", () => {
		const result = banner([[728, 90], [970, 250], [320, 50]])
		expect(result.display?.displayfmt).toHaveLength(3)
		expect(result.display?.displayfmt).toEqual([
			{ w: 728, h: 90 },
			{ w: 970, h: 250 },
			{ w: 320, h: 50 },
		])
	})

	it("throws when called with empty sizes", () => {
		expect(() => banner([])).toThrow("banner() requires at least one size")
	})

	it("passes through display options", () => {
		const result = banner([[300, 250]], { pos: 1 })
		expect(result.display?.pos).toBe(1)
		expect(result.display?.displayfmt).toEqual([{ w: 300, h: 250 }])
	})
})

describe("video()", () => {
	it("maps mimes to mime field", () => {
		const result = video({ mimes: ["video/mp4", "video/webm"] })
		expect(result.video?.mime).toEqual(["video/mp4", "video/webm"])
	})

	it("passes through VideoPlacement fields", () => {
		const result = video({ mimes: ["video/mp4"], maxdur: 30, mindur: 5 })
		expect(result.video?.mime).toEqual(["video/mp4"])
		expect(result.video?.maxdur).toBe(30)
		expect(result.video?.mindur).toBe(5)
	})
})

describe("native()", () => {
	it("creates assets for title and image", () => {
		const result = native([
			{ title: { len: 90 } },
			{ img: { type: 3 } },
		])
		const assets = result.display?.nativefmt?.asset
		expect(assets).toHaveLength(2)
		expect(assets?.[0]).toEqual({ id: 0, title: { len: 90 } })
		expect(assets?.[1]).toEqual({ id: 1, img: { type: 3 } })
	})

	it("creates a single asset for title only", () => {
		const result = native([{ title: { len: 25 } }])
		const assets = result.display?.nativefmt?.asset
		expect(assets).toHaveLength(1)
		expect(assets?.[0]).toEqual({ id: 0, title: { len: 25 } })
	})

	it("supports data assets", () => {
		const result = native([{ data: { type: 1, len: 100 } }])
		const assets = result.display?.nativefmt?.asset
		expect(assets?.[0]).toEqual({ id: 0, data: { type: 1, len: 100 } })
	})

	it("supports req flag", () => {
		const result = native([{ req: 1, title: { len: 90 } }])
		const assets = result.display?.nativefmt?.asset
		expect(assets?.[0]).toEqual({ id: 0, req: 1, title: { len: 90 } })
	})

	it("auto-increments asset ids", () => {
		const result = native([
			{ title: { len: 90 } },
			{ img: { type: 3 } },
			{ data: { type: 1 } },
		])
		const assets = result.display?.nativefmt?.asset
		expect(assets?.map((a) => a.id)).toEqual([0, 1, 2])
	})
})
