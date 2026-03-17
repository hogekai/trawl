import { describe, it, expect, vi } from "vitest"
import { buildDemandRequest } from "../src/demand-engine.js"
import type { Request, Item } from "iab-openrtb/v30"
import type { DemandAdapter } from "../src/types.js"

function makeReq(overrides?: Partial<Request>): Request {
	return {
		id: "req-1",
		item: [
			{ id: "imp-1", spec: {} },
			{ id: "imp-2", spec: {} },
		],
		...overrides,
	}
}

function makeAdapter(overrides?: Partial<DemandAdapter>): DemandAdapter {
	return {
		name: "test-adapter",
		endpoint: "https://example.com/bid",
		...overrides,
	}
}

describe("buildDemandRequest", () => {
	describe("item[] freeze", () => {
		it("freezes the item array", () => {
			const adapter = makeAdapter({
				impExt: (item) => {
					// shallow freeze: item props are mutable
					expect(() => {
						;(item as unknown as { spec: object }).spec = {}
					}).not.toThrow()
					return { x: 1 }
				},
			})
			const result = buildDemandRequest(makeReq(), adapter)
			if (!result.ok || "skipped" in result) throw new Error("unexpected")
			expect(result.ok).toBe(true)
		})

		it("prevents push/splice on the item array", () => {
			const req = makeReq()
			const adapter = makeAdapter({
				extensions: () => {
					// At this point req.item is frozen
					expect(() => {
						req.item.push({ id: "bad", spec: {} })
					}).toThrow()
					return {}
				},
			})
			buildDemandRequest(req, adapter)
		})
	})

	describe("extensions", () => {
		it("applies request ext", () => {
			const adapter = makeAdapter({
				extensions: () => ({ request: { foo: "bar" } }),
			})
			const result = buildDemandRequest(makeReq(), adapter)
			if (!result.ok || "skipped" in result) throw new Error("unexpected")
			expect(result.value.request.ext).toEqual({ foo: "bar" })
		})

		it("applies site ext", () => {
			const adapter = makeAdapter({
				extensions: () => ({ site: { siteKey: 1 } }),
			})
			const result = buildDemandRequest(makeReq(), adapter)
			if (!result.ok || "skipped" in result) throw new Error("unexpected")
			expect(result.value.request.context?.site?.ext).toEqual({ siteKey: 1 })
		})

		it("applies multiple context extensions simultaneously", () => {
			const adapter = makeAdapter({
				extensions: () => ({
					site: { s: 1 },
					user: { u: 2 },
					device: { d: 3 },
					regs: { r: 4 },
				}),
			})
			const result = buildDemandRequest(makeReq(), adapter)
			if (!result.ok || "skipped" in result) throw new Error("unexpected")
			const ctx = result.value.request.context
			expect(ctx?.site?.ext).toEqual({ s: 1 })
			expect(ctx?.user?.ext).toEqual({ u: 2 })
			expect(ctx?.device?.ext).toEqual({ d: 3 })
			expect(ctx?.regs?.ext).toEqual({ r: 4 })
		})

		it("merges with existing ext (adapter wins on conflict)", () => {
			const template = makeReq({
				ext: { existing: "keep", conflict: "old" },
			})
			const adapter = makeAdapter({
				extensions: () => ({ request: { conflict: "new", added: true } }),
			})
			const result = buildDemandRequest(template, adapter)
			if (!result.ok || "skipped" in result) throw new Error("unexpected")
			expect(result.value.request.ext).toEqual({
				existing: "keep",
				conflict: "new",
				added: true,
			})
		})

		it("auto-creates intermediate context path when context is undefined", () => {
			const template = makeReq() // no context
			const adapter = makeAdapter({
				extensions: () => ({ site: { foo: 1 } }),
			})
			const result = buildDemandRequest(template, adapter)
			if (!result.ok || "skipped" in result) throw new Error("unexpected")
			expect(result.value.request.context?.site?.ext).toEqual({ foo: 1 })
		})

		it("auto-creates intermediate when context exists but site is undefined", () => {
			const template = makeReq({ context: { user: {} } })
			const adapter = makeAdapter({
				extensions: () => ({ site: { bar: 2 } }),
			})
			const result = buildDemandRequest(template, adapter)
			if (!result.ok || "skipped" in result) throw new Error("unexpected")
			expect(result.value.request.context?.site?.ext).toEqual({ bar: 2 })
			// user should still exist
			expect(result.value.request.context?.user).toBeDefined()
		})

		it("returns DemandError when extensions() throws", () => {
			const adapter = makeAdapter({
				extensions: () => {
					throw new Error("ext boom")
				},
			})
			const result = buildDemandRequest(makeReq(), adapter)
			expect(result.ok).toBe(false)
			if (result.ok) throw new Error("unexpected")
			expect(result.error.type).toBe("invalid")
			expect(result.error.message).toBe("ext boom")
			expect(result.error.demandName).toBe("test-adapter")
		})
	})

	describe("impExt", () => {
		it("merges returned Record into item.ext", () => {
			const adapter = makeAdapter({
				impExt: () => ({ bidfloor: 0.5 }),
			})
			const result = buildDemandRequest(makeReq(), adapter)
			if (!result.ok || "skipped" in result) throw new Error("unexpected")
			for (const item of result.value.request.item) {
				expect(item.ext).toEqual({ bidfloor: 0.5 })
			}
		})

		it("excludes items when impExt returns null", () => {
			const adapter = makeAdapter({
				impExt: (item) => (item.id === "imp-1" ? { x: 1 } : null),
			})
			const result = buildDemandRequest(makeReq(), adapter)
			if (!result.ok || "skipped" in result) throw new Error("unexpected")
			expect(result.value.request.item).toHaveLength(1)
			expect(result.value.request.item[0]!.id).toBe("imp-1")
			expect(result.value.request.item[0]!.ext).toEqual({ x: 1 })
		})

		it("returns skipped when all items are null", () => {
			const adapter = makeAdapter({
				impExt: () => null,
			})
			const result = buildDemandRequest(makeReq(), adapter)
			expect(result.ok).toBe(true)
			if (!result.ok) throw new Error("unexpected")
			expect("skipped" in result).toBe(true)
			if (!("skipped" in result)) throw new Error("unexpected")
			expect(result.value.reason).toBe("all-items-null")
		})

		it("includes all items when adapter has no impExt", () => {
			const result = buildDemandRequest(makeReq(), makeAdapter())
			if (!result.ok || "skipped" in result) throw new Error("unexpected")
			expect(result.value.request.item).toHaveLength(2)
		})

		it("merges with existing item.ext", () => {
			const template = makeReq({
				item: [{ id: "imp-1", spec: {}, ext: { existing: true } }],
			})
			const adapter = makeAdapter({
				impExt: () => ({ added: true }),
			})
			const result = buildDemandRequest(template, adapter)
			if (!result.ok || "skipped" in result) throw new Error("unexpected")
			expect(result.value.request.item[0]!.ext).toEqual({
				existing: true,
				added: true,
			})
		})

		it("returns DemandError when impExt throws", () => {
			const adapter = makeAdapter({
				impExt: () => {
					throw new Error("impExt boom")
				},
			})
			const result = buildDemandRequest(makeReq(), adapter)
			expect(result.ok).toBe(false)
			if (result.ok) throw new Error("unexpected")
			expect(result.error.type).toBe("invalid")
			expect(result.error.message).toBe("impExt boom")
		})
	})

	describe("endpoint", () => {
		it("uses string endpoint directly", () => {
			const result = buildDemandRequest(makeReq(), makeAdapter())
			if (!result.ok || "skipped" in result) throw new Error("unexpected")
			expect(result.value.endpoint).toBe("https://example.com/bid")
		})

		it("calls function endpoint with the built request", () => {
			const endpointFn = vi.fn(() => "https://dynamic.com/bid")
			const adapter = makeAdapter({ endpoint: endpointFn })
			const result = buildDemandRequest(makeReq(), adapter)
			if (!result.ok || "skipped" in result) throw new Error("unexpected")
			expect(result.value.endpoint).toBe("https://dynamic.com/bid")
			expect(endpointFn).toHaveBeenCalledWith(result.value.request)
		})
	})

	describe("fetchOptions", () => {
		it("applies headers as object", () => {
			const adapter = makeAdapter({
				fetchOptions: {
					headers: { Authorization: "Bearer token" },
				},
			})
			const result = buildDemandRequest(makeReq(), adapter)
			if (!result.ok || "skipped" in result) throw new Error("unexpected")
			expect(result.value.requestInit.headers.Authorization).toBe(
				"Bearer token",
			)
		})

		it("applies headers as function", () => {
			const headersFn = vi.fn(() => ({ "X-Custom": "val" }))
			const adapter = makeAdapter({
				fetchOptions: { headers: headersFn },
			})
			const result = buildDemandRequest(makeReq(), adapter)
			if (!result.ok || "skipped" in result) throw new Error("unexpected")
			expect(result.value.requestInit.headers["X-Custom"]).toBe("val")
			expect(headersFn).toHaveBeenCalledWith(result.value.request)
		})

		it("sets default Content-Type to application/json", () => {
			const result = buildDemandRequest(makeReq(), makeAdapter())
			if (!result.ok || "skipped" in result) throw new Error("unexpected")
			expect(result.value.requestInit.headers["Content-Type"]).toBe(
				"application/json",
			)
		})

		it("uses custom contentType", () => {
			const adapter = makeAdapter({
				fetchOptions: { contentType: "application/octet-stream" },
			})
			const result = buildDemandRequest(makeReq(), adapter)
			if (!result.ok || "skipped" in result) throw new Error("unexpected")
			expect(result.value.requestInit.headers["Content-Type"]).toBe(
				"application/octet-stream",
			)
		})

		it("applies transform to body", () => {
			const adapter = makeAdapter({
				fetchOptions: {
					transform: (body) => body.replace(/"req-1"/, '"transformed"'),
				},
			})
			const result = buildDemandRequest(makeReq(), adapter)
			if (!result.ok || "skipped" in result) throw new Error("unexpected")
			expect(result.value.requestInit.body).toContain('"transformed"')
			expect(result.value.requestInit.body).not.toContain('"req-1"')
		})

		it("sets method to POST", () => {
			const result = buildDemandRequest(makeReq(), makeAdapter())
			if (!result.ok || "skipped" in result) throw new Error("unexpected")
			expect(result.value.requestInit.method).toBe("POST")
		})

		it("body is JSON stringified request", () => {
			const result = buildDemandRequest(makeReq(), makeAdapter())
			if (!result.ok || "skipped" in result) throw new Error("unexpected")
			const parsed = JSON.parse(result.value.requestInit.body)
			expect(parsed.id).toBe("req-1")
			expect(parsed.item).toHaveLength(2)
		})
	})
})
