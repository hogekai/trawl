import type { Request } from "iab-openrtb/v30"
import { afterEach, describe, expect, it, vi } from "vitest"
import { topics } from "../../src/web/topics.js"

const originalDocument = (globalThis as Record<string, unknown>).document

afterEach(() => {
	if (originalDocument === undefined) {
		;(globalThis as Record<string, unknown>).document = undefined
	} else {
		;(globalThis as Record<string, unknown>).document = originalDocument
	}
})

function makeReq(id = "req-1"): Request {
	return { id, item: [] }
}

const mockTopics = [
	{
		topic: 1,
		version: "chrome.1",
		configVersion: "1",
		modelVersion: "1",
		taxonomyVersion: "1",
	},
	{
		topic: 57,
		version: "chrome.1",
		configVersion: "1",
		modelVersion: "2",
		taxonomyVersion: "1",
	},
]

describe("topics", () => {
	it("sets user.ext.browsing_topics when browsingTopics is available", async () => {
		;(globalThis as Record<string, unknown>).document = {
			browsingTopics: vi.fn().mockResolvedValue(mockTopics),
		}

		const plugin = topics()
		const result = await plugin.onRequest?.(
			makeReq(),
			new AbortController().signal,
		)

		expect(result.context?.user?.ext?.browsing_topics).toEqual(mockTopics)
	})

	it("returns request unchanged when document is undefined", async () => {
		;(globalThis as Record<string, unknown>).document = undefined

		const plugin = topics()
		const req = makeReq()
		const result = await plugin.onRequest?.(req, new AbortController().signal)

		expect(result).toBe(req)
		expect(result.context).toBeUndefined()
	})

	it("returns request unchanged when browsingTopics is not a function", async () => {
		;(globalThis as Record<string, unknown>).document = {}

		const plugin = topics()
		const req = makeReq()
		const result = await plugin.onRequest?.(req, new AbortController().signal)

		expect(result).toBe(req)
		expect(result.context).toBeUndefined()
	})

	it("creates intermediate path objects when context is undefined", async () => {
		;(globalThis as Record<string, unknown>).document = {
			browsingTopics: vi.fn().mockResolvedValue(mockTopics),
		}

		const plugin = topics()
		const req = makeReq()
		expect(req.context).toBeUndefined()

		const result = await plugin.onRequest?.(req, new AbortController().signal)

		expect(result.context).toBeDefined()
		expect(result.context?.user?.ext?.browsing_topics).toEqual(mockTopics)
	})

	it("throws when browsingTopics rejects", async () => {
		;(globalThis as Record<string, unknown>).document = {
			browsingTopics: vi.fn().mockRejectedValue(new Error("not allowed")),
		}

		const plugin = topics()

		await expect(
			plugin.onRequest?.(makeReq(), new AbortController().signal),
		).rejects.toThrow("not allowed")
	})

	it("throws when signal is aborted", async () => {
		;(globalThis as Record<string, unknown>).document = {
			browsingTopics: vi.fn().mockImplementation(() => new Promise(() => {})),
		}

		const plugin = topics()
		const ac = new AbortController()
		ac.abort(new Error("timeout"))

		await expect(plugin.onRequest?.(makeReq(), ac.signal)).rejects.toThrow(
			"timeout",
		)
	})
})
