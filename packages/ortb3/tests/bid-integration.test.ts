import { describe, expect, it, vi } from "vitest"
import { banner, createAdSlots, item } from "../src/index.js"
import type { DemandAdapter, DemandPlugin, Plugin } from "../src/types.js"

function mockFetcherFromMap(
	responses: Record<string, unknown>,
): typeof globalThis.fetch {
	return (async (input: string | URL) => {
		const url = typeof input === "string" ? input : input.toString()
		const body = responses[url]
		if (body === undefined) throw new TypeError(`Network error: ${url}`)
		return {
			ok: true,
			status: 200,
			json: async () => body,
			text: async () => JSON.stringify(body),
		} as Response
	}) as typeof globalThis.fetch
}

function ortbResponse(bids: Array<{ item: string; price: number }>): unknown {
	return {
		id: "resp-1",
		seatbid: [{ bid: bids }],
	}
}

describe("bid() integration", () => {
	it("returns bids from a single demand", async () => {
		const ads = createAdSlots([item("imp-1", banner([300, 250]))], {
			fetcher: mockFetcherFromMap({
				"https://dsp-a.com/bid": ortbResponse([{ item: "imp-1", price: 2.5 }]),
			}),
		})
		ads.demand({
			name: "dsp-a",
			endpoint: "https://dsp-a.com/bid",
		})
		const result = await ads.bid()
		expect(result.requestId).toBeTruthy()
		expect(result.errors).toEqual([])
		const bids = result.bids.get("imp-1")
		expect(bids).toHaveLength(1)
		expect(bids?.[0]?.price).toBe(2.5)
	})

	it("returns bids from multiple demands", async () => {
		const ads = createAdSlots([item("imp-1", banner([300, 250]))], {
			fetcher: mockFetcherFromMap({
				"https://dsp-a.com/bid": ortbResponse([{ item: "imp-1", price: 1.0 }]),
				"https://dsp-b.com/bid": ortbResponse([{ item: "imp-1", price: 3.0 }]),
			}),
		})
		ads.demand({ name: "dsp-a", endpoint: "https://dsp-a.com/bid" })
		ads.demand({ name: "dsp-b", endpoint: "https://dsp-b.com/bid" })
		const result = await ads.bid()
		expect(result.errors).toEqual([])
		expect(result.bids.get("imp-1")).toHaveLength(2)
	})

	it("handles partial failure (one demand times out)", async () => {
		const fetcher = (async (
			input: string | URL,
			init?: Record<string, unknown>,
		) => {
			const url = typeof input === "string" ? input : input.toString()
			if (url === "https://slow.com/bid") {
				// simulate timeout by waiting then checking signal
				await new Promise((_, reject) => {
					const signal = init?.signal as AbortSignal
					if (signal?.aborted) {
						reject(new Error("aborted"))
						return
					}
					signal?.addEventListener("abort", () => {
						reject(new Error("aborted"))
					})
				})
			}
			return {
				ok: true,
				status: 200,
				json: async () => ortbResponse([{ item: "imp-1", price: 1.0 }]),
			} as Response
		}) as typeof globalThis.fetch

		const ads = createAdSlots([item("imp-1", banner([300, 250]))], { fetcher })
		ads.demand({ name: "fast", endpoint: "https://fast.com/bid" })
		ads.demand({ name: "slow", endpoint: "https://slow.com/bid" })
		const result = await ads.bid({ timeout: 50 })
		expect(result.bids.get("imp-1")).toHaveLength(1)
		expect(result.errors.length).toBeGreaterThanOrEqual(1)
		const timeoutErr = result.errors.find((e) => e.demandName === "slow")
		expect(timeoutErr).toBeDefined()
	})

	it("handles full failure (all demands error)", async () => {
		const ads = createAdSlots([item("imp-1", banner([300, 250]))], {
			fetcher: (async () => {
				throw new TypeError("network down")
			}) as typeof globalThis.fetch,
		})
		ads.demand({ name: "dsp-a", endpoint: "https://dsp-a.com/bid" })
		ads.demand({ name: "dsp-b", endpoint: "https://dsp-b.com/bid" })
		const result = await ads.bid()
		expect(result.bids.size).toBe(0)
		expect(result.errors).toHaveLength(2)
		expect(result.errors.every((e) => e.type === "network")).toBe(true)
	})

	it("returns empty BidResult with no demands", async () => {
		const ads = createAdSlots([item("imp-1", banner([300, 250]))])
		const result = await ads.bid()
		expect(result.bids.size).toBe(0)
		expect(result.errors).toEqual([])
		expect(result.requestId).toBeTruthy()
	})

	it("global request plugin modifies req for all demands", async () => {
		const bodies: unknown[] = []
		const fetcher = (async (
			_url: string | URL,
			init?: Record<string, unknown>,
		) => {
			bodies.push(JSON.parse(init?.body as string))
			return {
				ok: true,
				status: 200,
				json: async () => ortbResponse([]),
			} as Response
		}) as typeof globalThis.fetch

		const ads = createAdSlots([item("imp-1", banner([300, 250]))], { fetcher })
		ads.use({
			name: "global-ext",
			onRequest: (req) => {
				req.ext = { globalTag: true }
				return req
			},
		})
		ads.demand({ name: "dsp-a", endpoint: "https://dsp-a.com/bid" })
		ads.demand({ name: "dsp-b", endpoint: "https://dsp-b.com/bid" })
		await ads.bid()
		expect(bodies).toHaveLength(2)
		for (const body of bodies) {
			const envelope = body as Record<string, unknown>
			const request = envelope.request as Record<string, unknown>
			expect(request.ext).toEqual({ globalTag: true })
		}
	})

	it("demand request plugin only affects its own demand", async () => {
		const bodies = new Map<string, unknown>()
		const fetcher = (async (
			url: string | URL,
			init?: Record<string, unknown>,
		) => {
			bodies.set(
				typeof url === "string" ? url : url.toString(),
				JSON.parse(init?.body as string),
			)
			return {
				ok: true,
				status: 200,
				json: async () => ortbResponse([]),
			} as Response
		}) as typeof globalThis.fetch

		const ads = createAdSlots([item("imp-1", banner([300, 250]))], { fetcher })
		ads.demand({ name: "dsp-a", endpoint: "https://dsp-a.com/bid" }).with({
			name: "a-plugin",
			onRequest: (req) => {
				req.ext = { ...req.ext, demandSpecific: true }
				return req
			},
		})
		ads.demand({ name: "dsp-b", endpoint: "https://dsp-b.com/bid" })
		await ads.bid()

		const envelopeA = bodies.get("https://dsp-a.com/bid") as Record<string, unknown>
		const envelopeB = bodies.get("https://dsp-b.com/bid") as Record<string, unknown>
		const bodyA = envelopeA.request as Record<string, unknown>
		const bodyB = envelopeB.request as Record<string, unknown>
		expect(bodyA.ext).toEqual({ demandSpecific: true })
		expect(bodyB.ext).toBeUndefined()
	})

	it("demand response plugin filters bids", async () => {
		const ads = createAdSlots([item("imp-1", banner([300, 250]))], {
			fetcher: mockFetcherFromMap({
				"https://dsp-a.com/bid": ortbResponse([
					{ item: "imp-1", price: 0.5 },
					{ item: "imp-1", price: 2.0 },
				]),
			}),
		})
		ads
			.demand({
				name: "dsp-a",
				endpoint: "https://dsp-a.com/bid",
			})
			.with({
				name: "floor-filter",
				onResponse: (bids) => bids.filter((b) => b.price >= 1.0),
			})
		const result = await ads.bid()
		expect(result.bids.get("imp-1")).toHaveLength(1)
		expect(result.bids.get("imp-1")?.[0]?.price).toBe(2.0)
	})

	it("global response plugin filters across demands", async () => {
		const ads = createAdSlots([item("imp-1", banner([300, 250]))], {
			fetcher: mockFetcherFromMap({
				"https://dsp-a.com/bid": ortbResponse([{ item: "imp-1", price: 0.5 }]),
				"https://dsp-b.com/bid": ortbResponse([{ item: "imp-1", price: 3.0 }]),
			}),
		})
		ads.use({
			name: "global-floor",
			onResponse: (bids, _errors) => bids.filter((b) => b.price >= 1.0),
		})
		ads.demand({ name: "dsp-a", endpoint: "https://dsp-a.com/bid" })
		ads.demand({ name: "dsp-b", endpoint: "https://dsp-b.com/bid" })
		const result = await ads.bid()
		// dsp-a's bid (0.5) filtered by global plugin, only dsp-b's bid remains
		expect(result.bids.get("imp-1")).toHaveLength(1)
		expect(result.bids.get("imp-1")?.[0]?.price).toBe(3.0)
	})

	it("skips fetch when buildDemandRequest returns skipped", async () => {
		const fetchFn = vi.fn()
		const ads = createAdSlots([item("imp-1", banner([300, 250]))], {
			fetcher: fetchFn as unknown as typeof globalThis.fetch,
		})
		ads.demand({
			name: "dsp-a",
			endpoint: "https://dsp-a.com/bid",
			impExt: () => null, // exclude all items
		})
		const result = await ads.bid()
		expect(fetchFn).not.toHaveBeenCalled()
		expect(result.bids.size).toBe(0)
		expect(result.errors).toEqual([])
	})

	it("collects error when buildDemandRequest fails", async () => {
		const ads = createAdSlots([item("imp-1", banner([300, 250]))], {
			fetcher: mockFetcherFromMap({}),
		})
		ads.demand({
			name: "dsp-a",
			endpoint: "https://dsp-a.com/bid",
			extensions: () => {
				throw new Error("ext fail")
			},
		})
		const result = await ads.bid()
		expect(result.errors).toHaveLength(1)
		expect(result.errors[0]?.type).toBe("invalid")
		expect(result.errors[0]?.message).toBe("ext fail")
	})

	it("uses consistent requestId across result and errors", async () => {
		const ads = createAdSlots([item("imp-1", banner([300, 250]))], {
			fetcher: (async () => {
				throw new TypeError("fail")
			}) as typeof globalThis.fetch,
		})
		ads.demand({ name: "dsp-a", endpoint: "https://dsp-a.com/bid" })
		const result = await ads.bid()
		expect(result.requestId).toBeTruthy()
		for (const err of result.errors) {
			expect(err.requestId).toBe(result.requestId)
		}
	})

	it("plugin error is collected but pipeline continues", async () => {
		const ads = createAdSlots([item("imp-1", banner([300, 250]))], {
			fetcher: mockFetcherFromMap({
				"https://dsp-a.com/bid": ortbResponse([{ item: "imp-1", price: 1.0 }]),
			}),
		})
		ads.use({
			name: "bad-plugin",
			onRequest: () => {
				throw new Error("plugin crash")
			},
		})
		ads.demand({ name: "dsp-a", endpoint: "https://dsp-a.com/bid" })
		const result = await ads.bid()
		// Plugin error collected
		const pluginErr = result.errors.find(
			(e) => e.demandName === "plugin:bad-plugin",
		)
		expect(pluginErr).toBeDefined()
		// Pipeline still produced bids
		expect(result.bids.get("imp-1")).toHaveLength(1)
	})

	it("generates unique requestId per bid() call", async () => {
		const ads = createAdSlots([item("imp-1", banner([300, 250]))])
		const r1 = await ads.bid()
		const r2 = await ads.bid()
		expect(r1.requestId).not.toBe(r2.requestId)
	})
})
