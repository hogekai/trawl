import type { Bid, Seatbid } from "iab-openrtb/v30"
import type { DemandError, TrawlBidExt } from "./types.js"

export type ParseResult =
	| { ok: true; bids: Bid[] }
	| { ok: false; error: DemandError }

function extractSeatbid(json: unknown): Seatbid[] | undefined {
	if (typeof json !== "object" || json === null) return undefined
	const obj = json as Record<string, unknown>
	// Openrtb wrapper: { openrtb: { response: { seatbid } } }
	if ("openrtb" in obj) {
		const openrtb = obj.openrtb as Record<string, unknown> | undefined
		const response = openrtb?.response as
			| Record<string, unknown>
			| undefined
		return response?.seatbid as Seatbid[] | undefined
	}
	// Bare Response: { seatbid }
	return obj.seatbid as Seatbid[] | undefined
}

export async function parseResponse(
	response: Response,
	demandName: string,
	requestId: string,
): Promise<ParseResult> {
	if (!response.ok) {
		return {
			ok: false,
			error: {
				requestId,
				demandName,
				type: "network",
				message: `HTTP ${response.status}`,
			},
		}
	}

	let json: unknown
	try {
		json = await response.json()
	} catch {
		return {
			ok: false,
			error: {
				requestId,
				demandName,
				type: "parse",
				message: "Invalid JSON response",
			},
		}
	}

	const seatbid = extractSeatbid(json)
	if (!seatbid || seatbid.length === 0) {
		return { ok: true, bids: [] }
	}

	const fetchedAt = Date.now()
	const bids: Bid[] = []
	for (const sb of seatbid) {
		for (const bid of sb.bid) {
			bid.ext ??= {}
			;(bid.ext as Record<string, unknown>).trawl = {
				demandName,
				fetchedAt,
			} satisfies TrawlBidExt
			bids.push(bid)
		}
	}

	return { ok: true, bids }
}
