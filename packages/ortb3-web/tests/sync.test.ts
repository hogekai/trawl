import type { Bid } from "iab-openrtb/v30"
import { afterEach, describe, expect, it, vi } from "vitest"
import { sync } from "../src/sync.js"

const originalImage = globalThis.Image
const originalDocument = (globalThis as Record<string, unknown>).document

afterEach(() => {
	globalThis.Image = originalImage
	if (originalDocument === undefined) {
		;(globalThis as Record<string, unknown>).document = undefined
	} else {
		;(globalThis as Record<string, unknown>).document = originalDocument
	}
})

function makeBids(): Bid[] {
	return [
		{ id: "bid-1", item: "imp-1", price: 1.5 },
		{ id: "bid-2", item: "imp-2", price: 2.0 },
	]
}

describe("sync", () => {
	it("fires image pixel and returns bids unchanged", () => {
		const instances: { src: string }[] = []
		globalThis.Image = vi.fn().mockImplementation(() => {
			const img = { src: "" }
			instances.push(img)
			return img
		}) as unknown as typeof Image

		const plugin = sync("image", () => "https://pixel.example.com/sync")
		const bids = makeBids()
		const signal = new AbortController().signal

		const result = plugin.onResponse?.(bids, signal)

		expect(instances).toHaveLength(1)
		expect(instances[0]?.src).toBe("https://pixel.example.com/sync")
		expect(result).toBe(bids)
	})

	it("creates iframe and appends to body, returns bids unchanged", () => {
		const iframe = { src: "", width: "", height: "", style: { display: "" } }
		const appendChild = vi.fn()
		;(globalThis as Record<string, unknown>).document = {
			createElement: vi.fn().mockReturnValue(iframe),
			body: { appendChild },
		}

		const plugin = sync("iframe", () => "https://sync.example.com/iframe")
		const bids = makeBids()
		const signal = new AbortController().signal

		const result = plugin.onResponse?.(bids, signal)

		expect(iframe.src).toBe("https://sync.example.com/iframe")
		expect(iframe.width).toBe("0")
		expect(iframe.height).toBe("0")
		expect(iframe.style.display).toBe("none")
		expect(appendChild).toHaveBeenCalledWith(iframe)
		expect(result).toBe(bids)
	})

	it("passes consent string from buildUrl callback", () => {
		const instances: { src: string }[] = []
		globalThis.Image = vi.fn().mockImplementation(() => {
			const img = { src: "" }
			instances.push(img)
			return img
		}) as unknown as typeof Image

		const buildUrl = vi
			.fn()
			.mockReturnValue("https://pixel.example.com/sync?gdpr=1")
		const plugin = sync("image", buildUrl)
		plugin.onResponse?.(makeBids(), new AbortController().signal)

		expect(buildUrl).toHaveBeenCalled()
		expect(instances[0]?.src).toBe("https://pixel.example.com/sync?gdpr=1")
	})
})
