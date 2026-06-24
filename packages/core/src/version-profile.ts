export type ContextKey = "site" | "user" | "device" | "regs"

/**
 * The four+ touchpoints where an OpenRTB version differs from the
 * version-agnostic pipeline. Everything else (plugin phases, fetch, timeout,
 * error classification, auction) lives in core and reads the request/bid only
 * through this seam — so a v2.6 request can never be framed as a v3.0 envelope
 * (or vice-versa) by accident.
 */
export interface VersionProfile<TReq extends { id: string }, TBid, TImp> {
	/** Build the per-bid template request from this version's base/options. */
	buildTemplateRequest(id: string, imps: TImp[]): TReq

	/** The impression-id a bid refers to (v3.0 `bid.item` / v2.6 `bid.impid`). */
	impKeyOf(bid: TBid): string

	// --- request-building seam (consumed by buildDemandRequest) ---

	/** Freeze the impression array against mutation during adapter callbacks. */
	freezeImps(req: TReq): void
	/** Lazily resolve the request-level `ext` object to merge into. */
	requestExt(req: TReq): Record<string, unknown>
	/** Lazily resolve a context object's `ext` (site/user/device/regs). */
	contextExt(req: TReq, key: ContextKey): Record<string, unknown>
	/** The impression list carried by the request. */
	getImps(req: TReq): TImp[]
	/** Replace the impression list (after impExt filtering). */
	setImps(req: TReq, imps: TImp[]): void
	/** Lazily resolve an impression's `ext` object to merge into. */
	impExt(imp: TImp): Record<string, unknown>
	/** Frame the request into the wire body (v3.0 envelope / v2.6 identity). */
	frame(req: TReq): unknown

	// --- response-parsing seam (consumed by parseResponse) ---

	/** Extract seat bids from a decoded JSON response body. */
	extractSeatbid(json: unknown): { bid: TBid[] }[] | undefined
}
