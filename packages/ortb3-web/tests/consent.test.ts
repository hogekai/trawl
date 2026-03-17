import type { Request } from "iab-openrtb/v30"
import { describe, expect, it, vi } from "vitest"
import { consent } from "../src/consent.js"

function makeReq(id = "req-1"): Request {
	return { id, item: [] }
}

describe("consent", () => {
	it("sets regs.gdpr=1 and user.consent when gdprApplies is true", async () => {
		const getTCData = vi.fn().mockResolvedValue({
			gdprApplies: true,
			tcString: "BOValid123",
		})
		const plugin = consent(getTCData)
		const signal = new AbortController().signal

		const result = await plugin.onRequest?.(makeReq(), signal)

		expect(result.context?.regs?.gdpr).toBe(1)
		expect(result.context?.user?.consent).toBe("BOValid123")
	})

	it("sets regs.gdpr=0 when gdprApplies is false", async () => {
		const getTCData = vi.fn().mockResolvedValue({
			gdprApplies: false,
			tcString: "BONoApply",
		})
		const plugin = consent(getTCData)
		const signal = new AbortController().signal

		const result = await plugin.onRequest?.(makeReq(), signal)

		expect(result.context?.regs?.gdpr).toBe(0)
		expect(result.context?.user?.consent).toBe("BONoApply")
	})

	it("creates intermediate path objects when context is undefined", async () => {
		const getTCData = vi.fn().mockResolvedValue({
			gdprApplies: true,
			tcString: "TC",
		})
		const plugin = consent(getTCData)
		const req = makeReq()
		expect(req.context).toBeUndefined()

		const result = await plugin.onRequest?.(req, new AbortController().signal)

		expect(result.context).toBeDefined()
		expect(result.context?.regs?.gdpr).toBe(1)
		expect(result.context?.user?.consent).toBe("TC")
	})

	it("preserves existing context fields", async () => {
		const getTCData = vi.fn().mockResolvedValue({
			gdprApplies: true,
			tcString: "TC",
		})
		const plugin = consent(getTCData)
		const req = makeReq()
		req.context = { site: { domain: "example.com" } }

		const result = await plugin.onRequest?.(req, new AbortController().signal)

		expect(result.context?.site?.domain).toBe("example.com")
		expect(result.context?.regs?.gdpr).toBe(1)
	})

	it("throws when getTCData rejects", async () => {
		const getTCData = vi.fn().mockRejectedValue(new Error("CMP error"))
		const plugin = consent(getTCData)

		await expect(
			plugin.onRequest?.(makeReq(), new AbortController().signal),
		).rejects.toThrow("CMP error")
	})

	it("throws when signal is aborted", async () => {
		const getTCData = vi.fn().mockImplementation(() => new Promise(() => {}))
		const plugin = consent(getTCData)
		const ac = new AbortController()
		ac.abort(new Error("timeout"))

		await expect(plugin.onRequest?.(makeReq(), ac.signal)).rejects.toThrow(
			"timeout",
		)
	})
})
