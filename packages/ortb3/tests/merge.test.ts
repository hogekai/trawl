import { describe, expect, it } from "vitest"
import { merge } from "../src/merge.js"

describe("merge", () => {
	it("overwrites primitive with primitive", () => {
		const t = { a: 1 }
		merge(t, { a: 2 })
		expect(t).toEqual({ a: 2 })
	})

	it("ignores undefined in source", () => {
		const t = { a: 1 }
		merge(t, { a: undefined })
		expect(t).toEqual({ a: 1 })
	})

	it("overwrites with null", () => {
		const t: Record<string, unknown> = { a: 1 }
		merge(t, { a: null })
		expect(t).toEqual({ a: null })
	})

	it("replaces arrays (does not concat)", () => {
		const t = { a: [1, 2] }
		merge(t, { a: [3] })
		expect(t).toEqual({ a: [3] })
	})

	it("recursively merges objects", () => {
		const t = { a: { b: 1, c: 2 } }
		merge(t, { a: { c: 3 } })
		expect(t).toEqual({ a: { b: 1, c: 3 } })
	})

	it("adds new keys from source", () => {
		const t: Record<string, unknown> = { a: 1 }
		merge(t, { b: 2 })
		expect(t).toEqual({ a: 1, b: 2 })
	})

	it("handles 3+ levels of nesting", () => {
		const t = { a: { b: { c: { d: 1, e: 2 } } } }
		merge(t, { a: { b: { c: { e: 99, f: 3 } } } })
		expect(t).toEqual({ a: { b: { c: { d: 1, e: 99, f: 3 } } } })
	})

	it("overwrites primitive target with source object", () => {
		const t: Record<string, unknown> = { a: 1 }
		merge(t, { a: { b: 2 } })
		expect(t).toEqual({ a: { b: 2 } })
	})

	it("overwrites object target with source primitive", () => {
		const t: Record<string, unknown> = { a: { b: 1 } }
		merge(t, { a: 42 })
		expect(t).toEqual({ a: 42 })
	})

	it("returns the target reference", () => {
		const t = { a: 1 }
		const result = merge(t, { b: 2 })
		expect(result).toBe(t)
	})

	it("handles mixed types across keys", () => {
		const t: Record<string, unknown> = {
			keep: "yes",
			obj: { nested: 1 },
			arr: [1, 2],
			num: 10,
		}
		merge(t, {
			obj: { added: 2 },
			arr: [99],
			num: null,
			extra: "new",
			skip: undefined,
		})
		expect(t).toEqual({
			keep: "yes",
			obj: { nested: 1, added: 2 },
			arr: [99],
			num: null,
			extra: "new",
		})
	})
})
