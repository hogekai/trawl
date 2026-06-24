import type { ContextKey, VersionProfile } from "@trawl/core"
import type { Bid, Item, Openrtb, Request } from "iab-openrtb/v30"
import type { AdSlotsOptions } from "./types.js"

function extractSeatbid(json: unknown): { bid: Bid[] }[] | undefined {
	if (typeof json !== "object" || json === null) return undefined
	const obj = json as Record<string, unknown>

	// Openrtb envelope: { ver?, domainver, response: { seatbid } }
	if (
		"response" in obj &&
		typeof obj.response === "object" &&
		obj.response !== null
	) {
		const response = obj.response as Record<string, unknown>
		return response.seatbid as { bid: Bid[] }[] | undefined
	}

	// Bare BidResponse: { seatbid }
	if ("seatbid" in obj) {
		return obj.seatbid as { bid: Bid[] }[] | undefined
	}

	return undefined
}

/**
 * OpenRTB 3.0 / AdCOM version profile: `item[]` impressions, a top-level
 * `context` carrying site/user/device/regs, and the `Openrtb` envelope on the
 * wire. Bids reference their impression via `bid.item`.
 */
export function ortb3Profile(
	options?: AdSlotsOptions,
): VersionProfile<Request, Bid, Item> {
	const base = options?.request
	const envelope = options?.openrtb

	return {
		buildTemplateRequest(id, imps) {
			const req: Request = { ...base, id, item: imps }
			Object.freeze(req.item)
			return req
		},

		impKeyOf(bid) {
			return bid.item
		},

		freezeImps(req) {
			Object.freeze(req.item)
		},

		requestExt(req) {
			req.ext ??= {}
			return req.ext
		},

		contextExt(req, key: ContextKey) {
			req.context ??= {}
			const ctx = req.context as Record<
				string,
				{ ext?: Record<string, unknown> } | undefined
			>
			ctx[key] ??= {}
			const obj = ctx[key]!
			obj.ext ??= {}
			return obj.ext
		},

		getImps(req) {
			return req.item
		},

		setImps(req, imps) {
			;(req as { item: Item[] }).item = imps
		},

		impExt(imp) {
			imp.ext ??= {}
			return imp.ext as Record<string, unknown>
		},

		frame(req) {
			const env: Openrtb = {
				ver: envelope?.ver ?? "3.0",
				domainspec: envelope?.domainspec ?? "adcom",
				domainver: envelope?.domainver ?? "1.0",
				request: req,
			}
			return env
		},

		extractSeatbid,
	}
}
