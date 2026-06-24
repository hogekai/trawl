import { parseResponse } from "@trawl/core"
import { describe, expect, it } from "vitest"
import { ortb3Profile } from "../src/profile.js"

const profile = ortb3Profile()

function parse(
	response: Response,
	demandName = "demand-a",
	requestId = "req-1",
) {
	return parseResponse(response, demandName, requestId, Date.now, profile)
}

function mockResponse(body: unknown, status = 200): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
		text: async () => JSON.stringify(body),
	} as Response
}

function mockJsonError(status = 200): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => {
			throw new SyntaxError("Unexpected token")
		},
		text: async () => "not json",
	} as Response
}

describe("parseResponse (ortb3 profile)", () => {
	it("returns empty bids for HTTP 204 no-bid", async () => {
		const result = await parse({
			ok: true,
			status: 204,
			json: async () => {
				throw new SyntaxError("Unexpected end of JSON input")
			},
		} as Response)
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error("unexpected")
		expect(result.bids).toEqual([])
	})

	it("returns parse error for 200 with empty body", async () => {
		const result = await parse(mockJsonError())
		expect(result.ok).toBe(false)
		if (result.ok) throw new Error("unexpected")
		expect(result.error.type).toBe("parse")
	})

	it("returns network error for non-ok response", async () => {
		const result = await parse(mockResponse(null, 500))
		expect(result.ok).toBe(false)
		if (result.ok) throw new Error("unexpected")
		expect(result.error.type).toBe("network")
		expect(result.error.message).toBe("HTTP 500")
		expect(result.error.demandName).toBe("demand-a")
		expect(result.error.requestId).toBe("req-1")
	})

	it("returns parse error for invalid JSON", async () => {
		const result = await parse(mockJsonError())
		expect(result.ok).toBe(false)
		if (result.ok) throw new Error("unexpected")
		expect(result.error.type).toBe("parse")
		expect(result.error.message).toBe("Invalid JSON response")
	})

	it("returns empty bids when seatbid is empty array", async () => {
		const result = await parse(mockResponse({ id: "resp-1", seatbid: [] }))
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error("unexpected")
		expect(result.bids).toEqual([])
	})

	it("returns empty bids when no seatbid key", async () => {
		const result = await parse(mockResponse({ id: "resp-1" }))
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error("unexpected")
		expect(result.bids).toEqual([])
	})

	it("extracts bids from bare BidResponse with seatbid", async () => {
		const body = {
			id: "resp-1",
			seatbid: [
				{
					bid: [
						{ item: "imp-1", price: 1.5 },
						{ item: "imp-2", price: 2.0 },
					],
				},
			],
		}
		const result = await parse(mockResponse(body))
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error("unexpected")
		expect(result.bids).toHaveLength(2)
		expect(result.bids[0]?.item).toBe("imp-1")
		expect(result.bids[0]?.price).toBe(1.5)
		expect(result.bids[1]?.item).toBe("imp-2")
	})

	it("extracts bids from Openrtb envelope", async () => {
		const body = {
			ver: "3.0",
			domainspec: "adcom",
			domainver: "1.0",
			response: {
				id: "resp-1",
				seatbid: [{ bid: [{ item: "imp-1", price: 3.0 }] }],
			},
		}
		const result = await parse(mockResponse(body))
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error("unexpected")
		expect(result.bids).toHaveLength(1)
		expect(result.bids[0]?.price).toBe(3.0)
	})

	it("flattens bids from multiple seatbids", async () => {
		const body = {
			id: "resp-1",
			seatbid: [
				{ bid: [{ item: "imp-1", price: 1.0 }] },
				{ bid: [{ item: "imp-2", price: 2.0 }] },
			],
		}
		const result = await parse(mockResponse(body))
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error("unexpected")
		expect(result.bids).toHaveLength(2)
	})

	it("annotates each bid with ext.trawl using the injected clock", async () => {
		const body = {
			id: "resp-1",
			seatbid: [{ bid: [{ item: "imp-1", price: 1.0 }] }],
		}
		const result = await parseResponse(
			mockResponse(body),
			"demand-x",
			"req-42",
			() => 1234,
			profile,
		)
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error("unexpected")
		const trawl = (result.bids[0]?.ext as Record<string, unknown>).trawl as {
			demandName: string
			fetchedAt: number
		}
		expect(trawl.demandName).toBe("demand-x")
		expect(trawl.fetchedAt).toBe(1234)
	})
})
