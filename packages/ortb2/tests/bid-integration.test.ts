import { describe, expect, it } from "vitest"
import { banner, createAdSlots, imp } from "../src/index.js"

function mockFetcher(
	responses: Record<string, { body?: unknown; status?: number }>,
	capture?: { bodies: Record<string, unknown> },
): typeof globalThis.fetch {
	return (async (input: string | URL, init?: { body?: string }) => {
		const url = typeof input === "string" ? input : input.toString()
		const entry = responses[url]
		if (entry === undefined) throw new TypeError(`Network error: ${url}`)
		if (capture && init?.body) {
			capture.bodies[url] = JSON.parse(init.body)
		}
		const status = entry.status ?? 200
		return {
			ok: status >= 200 && status < 300,
			status,
			json: async () => entry.body,
			text: async () => JSON.stringify(entry.body),
		} as Response
	}) as typeof globalThis.fetch
}

function bidResponse(bids: Array<{ impid: string; price: number }>): unknown {
	return { id: "resp-1", seatbid: [{ bid: bids }] }
}

describe("ortb2 bid() integration", () => {
	it("returns bids keyed by impid from a single demand", async () => {
		const ads = createAdSlots([imp("s1", banner([[300, 250]]))], {
			fetcher: mockFetcher({
				"https://dsp-a.com/bid": {
					body: bidResponse([{ impid: "s1", price: 2.5 }]),
				},
			}),
		})
		ads.demand({ name: "dsp-a", endpoint: "https://dsp-a.com/bid" })

		const result = await ads.bid()
		expect(result.requestId).toBeTruthy()
		expect(result.errors).toEqual([])
		const bids = result.bids.get("s1")
		expect(bids).toHaveLength(1)
		expect(bids?.[0]?.price).toBe(2.5)
		expect((bids?.[0]?.ext as Record<string, unknown>).trawl).toMatchObject({
			demandName: "dsp-a",
		})
	})

	it("sends a bare BidRequest (no envelope) to the demand", async () => {
		const capture = { bodies: {} as Record<string, unknown> }
		const ads = createAdSlots([imp("s1", banner([[300, 250]]))], {
			fetcher: mockFetcher(
				{ "https://dsp-a.com/bid": { body: bidResponse([]) } },
				capture,
			),
		})
		ads.demand({ name: "dsp-a", endpoint: "https://dsp-a.com/bid" })
		await ads.bid()

		const sent = capture.bodies["https://dsp-a.com/bid"] as Record<
			string,
			unknown
		>
		expect(sent.id).toBeTruthy()
		expect(sent.imp).toHaveLength(1)
		// No v3.0 envelope keys.
		expect(sent.ver).toBeUndefined()
		expect(sent.request).toBeUndefined()
		expect(sent.context).toBeUndefined()
	})

	it("merges bids from multiple demands under the same impid", async () => {
		const ads = createAdSlots([imp("s1", banner([[300, 250]]))], {
			fetcher: mockFetcher({
				"https://dsp-a.com/bid": {
					body: bidResponse([{ impid: "s1", price: 1.0 }]),
				},
				"https://dsp-b.com/bid": {
					body: bidResponse([{ impid: "s1", price: 3.0 }]),
				},
			}),
		})
		ads.demand({ name: "dsp-a", endpoint: "https://dsp-a.com/bid" })
		ads.demand({ name: "dsp-b", endpoint: "https://dsp-b.com/bid" })

		const result = await ads.bid()
		expect(result.errors).toEqual([])
		expect(result.bids.get("s1")).toHaveLength(2)
	})

	it("treats HTTP 204 as a no-bid with no error", async () => {
		const ads = createAdSlots([imp("s1", banner([[300, 250]]))], {
			fetcher: mockFetcher({
				"https://dsp-a.com/bid": { status: 204 },
			}),
		})
		ads.demand({ name: "dsp-a", endpoint: "https://dsp-a.com/bid" })

		const result = await ads.bid()
		expect(result.errors).toEqual([])
		expect(result.bids.size).toBe(0)
	})

	it("classifies a non-200 as a network error", async () => {
		const ads = createAdSlots([imp("s1", banner([[300, 250]]))], {
			fetcher: mockFetcher({
				"https://dsp-a.com/bid": { status: 500, body: null },
			}),
		})
		ads.demand({ name: "dsp-a", endpoint: "https://dsp-a.com/bid" })

		const result = await ads.bid()
		expect(result.bids.size).toBe(0)
		expect(result.errors).toHaveLength(1)
		expect(result.errors[0]?.type).toBe("network")
		expect(result.errors[0]?.demandName).toBe("dsp-a")
	})

	it("classifies an unreachable endpoint as a network error", async () => {
		const ads = createAdSlots([imp("s1", banner([[300, 250]]))], {
			fetcher: mockFetcher({}),
		})
		ads.demand({ name: "dsp-a", endpoint: "https://dsp-a.com/bid" })

		const result = await ads.bid()
		expect(result.errors[0]?.type).toBe("network")
	})
})
