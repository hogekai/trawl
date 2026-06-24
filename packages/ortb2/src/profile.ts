import type { ContextKey, VersionProfile } from "@trawl/core"
import type { Bid, BidRequest, Imp } from "iab-openrtb/v26"
import type { AdSlotsOptions } from "./types.js"

function extractSeatbid(json: unknown): { bid: Bid[] }[] | undefined {
	if (typeof json !== "object" || json === null) return undefined
	const obj = json as Record<string, unknown>
	// v2.6 responses are a bare BidResponse — no envelope.
	if ("seatbid" in obj) {
		return obj.seatbid as { bid: Bid[] }[] | undefined
	}
	return undefined
}

/**
 * OpenRTB 2.6 version profile: `imp[]` impressions, top-level
 * site/app/user/device/regs, and the bare `BidRequest` on the wire (no
 * envelope). Bids reference their impression via `bid.impid`.
 */
export function ortb2Profile(
	options?: AdSlotsOptions,
): VersionProfile<BidRequest, Bid, Imp> {
	const base = options?.request

	return {
		buildTemplateRequest(id, imps) {
			const req: BidRequest = { ...base, id, imp: imps }
			Object.freeze(req.imp)
			return req
		},

		impKeyOf(bid) {
			return bid.impid
		},

		freezeImps(req) {
			Object.freeze(req.imp)
		},

		requestExt(req) {
			req.ext ??= {}
			return req.ext
		},

		contextExt(req, key: ContextKey) {
			// v2.6 carries site/user/device/regs at the top level (no `context`).
			const target = req as unknown as Record<
				string,
				{ ext?: Record<string, unknown> } | undefined
			>
			target[key] ??= {}
			const obj = target[key]!
			obj.ext ??= {}
			return obj.ext
		},

		getImps(req) {
			return req.imp
		},

		setImps(req, imps) {
			;(req as { imp: Imp[] }).imp = imps
		},

		impExt(imp) {
			imp.ext ??= {}
			return imp.ext as Record<string, unknown>
		},

		frame(req) {
			// No envelope — the bare BidRequest is the wire body.
			return req
		},

		extractSeatbid,
	}
}
