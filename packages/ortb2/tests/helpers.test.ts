import { describe, expect, it } from "vitest"
import { audio, banner, imp, native, video } from "../src/index.js"

describe("imp()", () => {
	it("creates an Imp with id and a single media fragment", () => {
		const i = imp("slot-1", banner([[300, 250]]))
		expect(i.id).toBe("slot-1")
		expect(i.banner?.format).toEqual([{ w: 300, h: 250 }])
	})

	it("deep-merges multiple media fragments for multi-format", () => {
		const i = imp(
			"multi",
			banner([[300, 250]]),
			video({ mimes: ["video/mp4"] }),
		)
		expect(i.banner?.format).toEqual([{ w: 300, h: 250 }])
		expect(i.video?.mimes).toEqual(["video/mp4"])
	})

	it("merges extra Imp fields like bidfloor/tagid", () => {
		const i = imp("s", banner([[300, 250]]), { bidfloor: 0.5, tagid: "t1" })
		expect(i.bidfloor).toBe(0.5)
		expect(i.tagid).toBe("t1")
	})
})

describe("banner()", () => {
	it("maps sizes to the v2.6 Banner.format array", () => {
		const result = banner([
			[728, 90],
			[970, 250],
		])
		expect(result.banner?.format).toEqual([
			{ w: 728, h: 90 },
			{ w: 970, h: 250 },
		])
	})

	it("throws when called with empty sizes", () => {
		expect(() => banner([])).toThrow("banner() requires at least one size")
	})

	it("passes through banner options", () => {
		const result = banner([[300, 250]], { pos: 1 })
		expect(result.banner?.pos).toBe(1)
		expect(result.banner?.format).toEqual([{ w: 300, h: 250 }])
	})
})

describe("video()", () => {
	it("sets mimes and passes through VideoObject fields", () => {
		const result = video({
			mimes: ["video/mp4"],
			minduration: 5,
			maxduration: 30,
		})
		expect(result.video?.mimes).toEqual(["video/mp4"])
		expect(result.video?.minduration).toBe(5)
		expect(result.video?.maxduration).toBe(30)
	})
})

describe("audio()", () => {
	it("sets mimes and passes through AudioObject fields", () => {
		const result = audio({ mimes: ["audio/mp4"], maxduration: 30 })
		expect(result.audio?.mimes).toEqual(["audio/mp4"])
		expect(result.audio?.maxduration).toBe(30)
	})
})

describe("native()", () => {
	it("stringifies a request object with the default ver", () => {
		const result = native({ ver: "1.2", assets: [{ id: 0 }] })
		expect(result.native?.ver).toBe("1.2")
		expect(JSON.parse(result.native?.request ?? "")).toEqual({
			ver: "1.2",
			assets: [{ id: 0 }],
		})
	})

	it("passes a pre-built request string through unchanged", () => {
		const result = native('{"assets":[]}', "1.1")
		expect(result.native?.request).toBe('{"assets":[]}')
		expect(result.native?.ver).toBe("1.1")
	})
})
