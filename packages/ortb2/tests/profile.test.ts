import { buildDemandRequest, parseResponse } from "@trawl/core"
import type { Bid } from "iab-openrtb/v26"
import { describe, expect, it } from "vitest"
import { banner, imp } from "../src/index.js"
import { ortb2Profile } from "../src/profile.js"
import type { DemandAdapter } from "../src/types.js"

const profile = ortb2Profile()

function makeReq() {
	return profile.buildTemplateRequest("req-1", [
		imp("s1", banner([[300, 250]])),
		imp("s2", banner([[728, 90]])),
	])
}

function makeAdapter(overrides?: Partial<DemandAdapter>): DemandAdapter {
	return { name: "dsp", endpoint: "https://dsp.example.com/bid", ...overrides }
}

describe("ortb2Profile shape", () => {
	it("builds a template request with imp[] and freezes it", () => {
		const req = makeReq()
		expect(req.id).toBe("req-1")
		expect(req.imp).toHaveLength(2)
		expect(Object.isFrozen(req.imp)).toBe(true)
		expect("context" in req).toBe(false)
		expect("item" in req).toBe(false)
	})

	it("keys bids by impid (not item)", () => {
		const bid = { id: "b1", impid: "s1", price: 1.0 } as Bid
		expect(profile.impKeyOf(bid)).toBe("s1")
	})

	it("frames the request as the bare body (no envelope)", () => {
		const req = makeReq()
		expect(profile.frame(req)).toBe(req)
	})

	it("extracts seatbid from a bare BidResponse", () => {
		expect(profile.extractSeatbid({ seatbid: [{ bid: [] }] })).toEqual([
			{ bid: [] },
		])
	})

	it("does not unwrap a v3.0 envelope", () => {
		expect(
			profile.extractSeatbid({ response: { seatbid: [{ bid: [] }] } }),
		).toBeUndefined()
	})
})

describe("buildDemandRequest with ortb2Profile", () => {
	it("applies site ext at the top level (no context wrapper)", () => {
		const result = buildDemandRequest(
			makeReq(),
			makeAdapter({ extensions: () => ({ site: { s: 1 }, user: { u: 2 } }) }),
			profile,
		)
		if (!result.ok || "skipped" in result) throw new Error("unexpected")
		const req = result.value.request as unknown as Record<
			string,
			{ ext?: unknown }
		>
		expect(req.site?.ext).toEqual({ s: 1 })
		expect(req.user?.ext).toEqual({ u: 2 })
		expect("context" in result.value.request).toBe(false)
	})

	it("sends the bare BidRequest as the body — no envelope keys", () => {
		const result = buildDemandRequest(makeReq(), makeAdapter(), profile)
		if (!result.ok || "skipped" in result) throw new Error("unexpected")
		const parsed = JSON.parse(result.value.requestInit.body)
		expect(parsed.id).toBe("req-1")
		expect(parsed.imp).toHaveLength(2)
		expect(parsed.ver).toBeUndefined()
		expect(parsed.request).toBeUndefined()
	})

	it("filters imps via impExt and drops nulls", () => {
		const result = buildDemandRequest(
			makeReq(),
			makeAdapter({
				impExt: (i) => (i.id === "s1" ? { bidfloor: 0.5 } : null),
			}),
			profile,
		)
		if (!result.ok || "skipped" in result) throw new Error("unexpected")
		expect(result.value.request.imp).toHaveLength(1)
		expect(result.value.request.imp[0]?.id).toBe("s1")
		expect(result.value.request.imp[0]?.ext).toEqual({ bidfloor: 0.5 })
	})
})

describe("parseResponse with ortb2Profile", () => {
	function mockResponse(body: unknown, status = 200): Response {
		return {
			ok: status >= 200 && status < 300,
			status,
			json: async () => body,
			text: async () => JSON.stringify(body),
		} as Response
	}

	it("extracts bids keyed by impid and annotates ext.trawl", async () => {
		const body = {
			id: "resp-1",
			seatbid: [{ bid: [{ id: "b1", impid: "s1", price: 1.5 }] }],
		}
		const result = await parseResponse(
			mockResponse(body),
			"dsp",
			"req-1",
			() => 99,
			profile,
		)
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error("unexpected")
		expect(result.bids).toHaveLength(1)
		expect(result.bids[0]?.impid).toBe("s1")
		expect((result.bids[0]?.ext as Record<string, unknown>).trawl).toEqual({
			demandName: "dsp",
			fetchedAt: 99,
		})
	})
})
