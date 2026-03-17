import { describe, expect, it } from "vitest"
import { raceSignal } from "../../src/web/race-signal.js"

describe("raceSignal", () => {
	it("resolves when promise resolves before signal", async () => {
		const signal = new AbortController().signal
		const result = await raceSignal(Promise.resolve("ok"), signal)
		expect(result).toBe("ok")
	})

	it("rejects when signal is already aborted", async () => {
		const ac = new AbortController()
		ac.abort(new Error("aborted"))
		await expect(raceSignal(new Promise(() => {}), ac.signal)).rejects.toThrow(
			"aborted",
		)
	})

	it("rejects when signal aborts during execution", async () => {
		const ac = new AbortController()
		const slow = new Promise<string>((resolve) =>
			setTimeout(() => resolve("late"), 500),
		)
		const p = raceSignal(slow, ac.signal)
		ac.abort(new Error("cancelled"))
		await expect(p).rejects.toThrow("cancelled")
	})

	it("rejects when promise rejects", async () => {
		const signal = new AbortController().signal
		await expect(
			raceSignal(Promise.reject(new Error("fail")), signal),
		).rejects.toThrow("fail")
	})
})
