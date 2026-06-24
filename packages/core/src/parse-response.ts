import type { DemandError, TrawlBidExt } from "./types.js"
import type { VersionProfile } from "./version-profile.js"

export type ParseResult<TBid> =
	| { ok: true; bids: TBid[] }
	| { ok: false; error: DemandError }

export async function parseResponse<TReq extends { id: string }, TBid, TImp>(
	response: Response,
	demandName: string,
	requestId: string,
	now: () => number,
	profile: VersionProfile<TReq, TBid, TImp>,
): Promise<ParseResult<TBid>> {
	if (response.status === 204) {
		return { ok: true, bids: [] }
	}

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

	const seatbid = profile.extractSeatbid(json)
	if (!seatbid || seatbid.length === 0) {
		return { ok: true, bids: [] }
	}

	const fetchedAt = now()
	const bids: TBid[] = []
	for (const sb of seatbid) {
		for (const bid of sb.bid) {
			const annotated = bid as { ext?: Record<string, unknown> }
			annotated.ext ??= {}
			annotated.ext.trawl = {
				demandName,
				fetchedAt,
			} satisfies TrawlBidExt
			bids.push(bid)
		}
	}

	return { ok: true, bids }
}
