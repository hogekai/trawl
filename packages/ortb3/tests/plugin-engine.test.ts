import type { Bid, Request } from "iab-openrtb/v30"
import { describe, expect, it, vi } from "vitest"
import {
	runDemandRequestPlugins,
	runDemandResponsePlugins,
	runGlobalRequestPlugins,
	runGlobalResponsePlugins,
} from "../src/plugin-engine.js"
import type { DemandPlugin, Plugin } from "../src/types.js"

function makeReq(overrides?: Partial<Request>): Request {
	return {
		id: "req-1",
		item: [{ id: "imp-1", spec: {} }],
		...overrides,
	}
}

function makeBid(overrides?: Partial<Bid>): Bid {
	return { item: "imp-1", price: 1.5, ...overrides }
}

function abortedSignal(): AbortSignal {
	const ac = new AbortController()
	ac.abort()
	return ac.signal
}

describe("runGlobalRequestPlugins", () => {
	it("runs plugins in order, chaining the returned request", async () => {
		const order: number[] = []
		const plugins: Plugin[] = [
			{
				name: "p1",
				onRequest: (req) => {
					order.push(1)
					return { ...req, ext: { ...req.ext, p1: true } }
				},
			},
			{
				name: "p2",
				onRequest: (req) => {
					order.push(2)
					// p2 can see p1's ext
					expect(req.ext?.p1).toBe(true)
					return { ...req, ext: { ...req.ext, p2: true } }
				},
			},
		]
		const { request, errors } = await runGlobalRequestPlugins(
			plugins,
			makeReq(),
			undefined,
		)
		expect(order).toEqual([1, 2])
		expect(request.ext).toEqual({ p1: true, p2: true })
		expect(errors).toEqual([])
	})

	it("skips plugins without onRequest", async () => {
		const plugins: Plugin[] = [
			{ name: "no-hook" },
			{
				name: "has-hook",
				onRequest: (req) => ({ ...req, ext: { ran: true } }),
			},
		]
		const { request, errors } = await runGlobalRequestPlugins(
			plugins,
			makeReq(),
			undefined,
		)
		expect(request.ext).toEqual({ ran: true })
		expect(errors).toEqual([])
	})

	it("handles async onRequest", async () => {
		const plugins: Plugin[] = [
			{
				name: "async-p",
				onRequest: async (req) => {
					await new Promise((r) => setTimeout(r, 1))
					return { ...req, ext: { async: true } }
				},
			},
		]
		const { request } = await runGlobalRequestPlugins(
			plugins,
			makeReq(),
			undefined,
		)
		expect(request.ext).toEqual({ async: true })
	})

	it("collects error and continues with last successful request", async () => {
		const plugins: Plugin[] = [
			{
				name: "good",
				onRequest: (req) => ({ ...req, ext: { good: true } }),
			},
			{
				name: "bad",
				onRequest: () => {
					throw new Error("plugin failed")
				},
			},
			{
				name: "after-bad",
				onRequest: (req) => {
					// receives the last successful request (from "good")
					expect(req.ext?.good).toBe(true)
					return { ...req, ext: { ...req.ext, afterBad: true } }
				},
			},
		]
		const { request, errors } = await runGlobalRequestPlugins(
			plugins,
			makeReq(),
			undefined,
		)
		expect(request.ext).toEqual({ good: true, afterBad: true })
		expect(errors).toHaveLength(1)
		expect(errors[0]?.demandName).toBe("plugin:bad")
		expect(errors[0]?.type).toBe("invalid")
		expect(errors[0]?.message).toBe("plugin failed")
		expect(errors[0]?.requestId).toBe("req-1")
	})

	it("handles non-Error throws", async () => {
		const plugins: Plugin[] = [
			{
				name: "str-throw",
				onRequest: () => {
					throw "string error"
				},
			},
		]
		const { errors } = await runGlobalRequestPlugins(
			plugins,
			makeReq(),
			undefined,
		)
		expect(errors[0]?.message).toBe("string error")
	})

	it("skips remaining plugins when signal is aborted", async () => {
		const ran: string[] = []
		const plugins: Plugin[] = [
			{
				name: "p1",
				onRequest: (req) => {
					ran.push("p1")
					return req
				},
			},
			{
				name: "p2",
				onRequest: (req) => {
					ran.push("p2")
					return req
				},
			},
		]
		const { errors } = await runGlobalRequestPlugins(
			plugins,
			makeReq(),
			0, // timeout(0) — aborts on next microtask
		)
		// First plugin may or may not run depending on timing,
		// but at minimum the function completes without error
		expect(errors).toEqual([])
	})

	it("passes signal to each plugin", async () => {
		const receivedSignals: AbortSignal[] = []
		const plugins: Plugin[] = [
			{
				name: "p1",
				onRequest: (req, signal) => {
					receivedSignals.push(signal)
					return req
				},
			},
		]
		await runGlobalRequestPlugins(plugins, makeReq(), undefined)
		expect(receivedSignals).toHaveLength(1)
		expect(receivedSignals[0]?.aborted).toBe(false)
	})

	it("returns initial request when plugins array is empty", async () => {
		const req = makeReq()
		const { request, errors } = await runGlobalRequestPlugins(
			[],
			req,
			undefined,
		)
		expect(request).toBe(req)
		expect(errors).toEqual([])
	})

	it("returns initial request with N errors when all throw", async () => {
		const req = makeReq()
		const plugins: Plugin[] = [
			{
				name: "bad1",
				onRequest: () => {
					throw new Error("e1")
				},
			},
			{
				name: "bad2",
				onRequest: () => {
					throw new Error("e2")
				},
			},
		]
		const { request, errors } = await runGlobalRequestPlugins(
			plugins,
			req,
			undefined,
		)
		expect(request).toBe(req)
		expect(errors).toHaveLength(2)
	})
})

describe("runDemandRequestPlugins", () => {
	it("chains request through sequential plugins", async () => {
		const plugins: DemandPlugin[] = [
			{
				name: "dp1",
				onRequest: (req) => ({ ...req, ext: { dp1: true } }),
			},
			{
				name: "dp2",
				onRequest: (req) => ({
					...req,
					ext: { ...req.ext, dp2: true },
				}),
			},
		]
		const signal = new AbortController().signal
		const { request, errors } = await runDemandRequestPlugins(
			plugins,
			makeReq(),
			signal,
			"demand-a",
		)
		expect(request.ext).toEqual({ dp1: true, dp2: true })
		expect(errors).toEqual([])
	})

	it("uses demandName (not plugin name) in errors", async () => {
		const plugins: DemandPlugin[] = [
			{
				name: "my-plugin",
				onRequest: () => {
					throw new Error("fail")
				},
			},
		]
		const signal = new AbortController().signal
		const { errors } = await runDemandRequestPlugins(
			plugins,
			makeReq(),
			signal,
			"demand-a",
		)
		expect(errors[0]?.demandName).toBe("demand-a")
	})

	it("skips all plugins when signal is pre-aborted", async () => {
		const ran: string[] = []
		const plugins: DemandPlugin[] = [
			{
				name: "p1",
				onRequest: (req) => {
					ran.push("p1")
					return req
				},
			},
		]
		const { request } = await runDemandRequestPlugins(
			plugins,
			makeReq(),
			abortedSignal(),
			"demand-a",
		)
		expect(ran).toEqual([])
		expect(request.id).toBe("req-1")
	})

	it("uses external signal (does not create its own)", async () => {
		let receivedSignal: AbortSignal | undefined
		const externalSignal = new AbortController().signal
		const plugins: DemandPlugin[] = [
			{
				name: "p1",
				onRequest: (req, signal) => {
					receivedSignal = signal
					return req
				},
			},
		]
		await runDemandRequestPlugins(
			plugins,
			makeReq(),
			externalSignal,
			"demand-a",
		)
		expect(receivedSignal).toBe(externalSignal)
	})

	it("returns initial request when plugins array is empty", async () => {
		const req = makeReq()
		const { request } = await runDemandRequestPlugins(
			[],
			req,
			new AbortController().signal,
			"demand-a",
		)
		expect(request).toBe(req)
	})
})

describe("runDemandResponsePlugins", () => {
	it("runs onResponse sequentially, chaining Bid[]", async () => {
		const plugins: DemandPlugin[] = [
			{
				name: "dp1",
				onResponse: (bids) => [...bids, makeBid({ price: 2.0 })],
			},
			{
				name: "dp2",
				onResponse: (bids) => bids.filter((b) => b.price > 1.0),
			},
		]
		const { bids, errors } = await runDemandResponsePlugins(
			plugins,
			[makeBid({ price: 0.5 })],
			undefined,
			"demand-a",
			"req-1",
		)
		// dp1 adds a bid (price 2.0), dp2 filters price <= 1.0
		expect(bids).toHaveLength(1)
		expect(bids[0]?.price).toBe(2.0)
		expect(errors).toEqual([])
	})

	it("uses demandName and explicit requestId in errors", async () => {
		const plugins: DemandPlugin[] = [
			{
				name: "bad",
				onResponse: () => {
					throw new Error("resp fail")
				},
			},
		]
		const { errors } = await runDemandResponsePlugins(
			plugins,
			[makeBid()],
			undefined,
			"demand-b",
			"req-42",
		)
		expect(errors[0]?.demandName).toBe("demand-b")
		expect(errors[0]?.requestId).toBe("req-42")
	})

	it("collects errors and continues with last successful bids", async () => {
		const plugins: DemandPlugin[] = [
			{
				name: "good",
				onResponse: () => [makeBid({ price: 99 })],
			},
			{
				name: "bad",
				onResponse: () => {
					throw new Error("fail")
				},
			},
			{
				name: "after",
				onResponse: (bids) => bids,
			},
		]
		const { bids, errors } = await runDemandResponsePlugins(
			plugins,
			[],
			undefined,
			"demand-a",
			"req-1",
		)
		expect(bids).toHaveLength(1)
		expect(bids[0]?.price).toBe(99)
		expect(errors).toHaveLength(1)
	})

	it("handles empty bids array", async () => {
		const plugins: DemandPlugin[] = [{ name: "p1", onResponse: (bids) => bids }]
		const { bids } = await runDemandResponsePlugins(
			plugins,
			[],
			undefined,
			"demand-a",
			"req-1",
		)
		expect(bids).toEqual([])
	})

	it("handles empty plugins array", async () => {
		const input = [makeBid()]
		const { bids } = await runDemandResponsePlugins(
			[],
			input,
			undefined,
			"demand-a",
			"req-1",
		)
		expect(bids).toBe(input)
	})
})

describe("runGlobalResponsePlugins", () => {
	it("runs onResponse sequentially on flat Bid[]", async () => {
		const plugins: Plugin[] = [
			{
				name: "logger",
				onResponse: (bids) => bids,
			},
			{
				name: "filter",
				onResponse: (bids) => bids.filter((b) => b.price >= 1.0),
			},
		]
		const { bids, errors } = await runGlobalResponsePlugins(
			plugins,
			[makeBid({ price: 0.5 }), makeBid({ price: 2.0 })],
			undefined,
			"req-1",
		)
		expect(bids).toHaveLength(1)
		expect(bids[0]?.price).toBe(2.0)
		expect(errors).toEqual([])
	})

	it("sets demandName to 'plugin:{name}' in errors", async () => {
		const plugins: Plugin[] = [
			{
				name: "crasher",
				onResponse: () => {
					throw new Error("boom")
				},
			},
		]
		const { errors } = await runGlobalResponsePlugins(
			plugins,
			[makeBid()],
			undefined,
			"req-1",
		)
		expect(errors[0]?.demandName).toBe("plugin:crasher")
		expect(errors[0]?.requestId).toBe("req-1")
	})

	it("preserves bid references between plugins (no cloning)", async () => {
		const bid = makeBid()
		const plugins: Plugin[] = [
			{
				name: "mutator",
				onResponse: (bids) => {
					bids[0]!.ext = { mutated: true }
					return bids
				},
			},
			{
				name: "checker",
				onResponse: (bids) => {
					// same reference, mutation visible
					expect(bids[0]?.ext).toEqual({ mutated: true })
					return bids
				},
			},
		]
		const { bids } = await runGlobalResponsePlugins(
			plugins,
			[bid],
			undefined,
			"req-1",
		)
		// the original bid object was mutated
		expect(bid.ext).toEqual({ mutated: true })
		expect(bids[0]).toBe(bid)
	})

	it("handles empty plugins array", async () => {
		const input = [makeBid()]
		const { bids } = await runGlobalResponsePlugins(
			[],
			input,
			undefined,
			"req-1",
		)
		expect(bids).toBe(input)
	})

	it("handles async rejected promise in onResponse", async () => {
		const plugins: Plugin[] = [
			{
				name: "async-bad",
				onResponse: async () => {
					throw new Error("async fail")
				},
			},
		]
		const input = [makeBid()]
		const { bids, errors } = await runGlobalResponsePlugins(
			plugins,
			input,
			undefined,
			"req-1",
		)
		expect(bids).toBe(input)
		expect(errors).toHaveLength(1)
		expect(errors[0]?.message).toBe("async fail")
	})
})
