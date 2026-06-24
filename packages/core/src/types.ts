export interface TrawlBidExt {
	demandName: string
	fetchedAt: number
}

export interface DemandError {
	requestId: string
	demandName: string
	type: "timeout" | "network" | "parse" | "invalid" | "unknown"
	message: string
}

export interface DemandExtensions {
	request?: Record<string, unknown>
	site?: Record<string, unknown>
	user?: Record<string, unknown>
	device?: Record<string, unknown>
	regs?: Record<string, unknown>
}

export interface Plugin<TReq, TBid> {
	name: string
	onRequest?: (request: TReq, signal: AbortSignal) => TReq | Promise<TReq>
	onResponse?: (
		bids: TBid[],
		errors: readonly DemandError[],
		signal: AbortSignal,
	) => TBid[] | Promise<TBid[]>
}

export interface DemandPlugin<TReq, TBid> {
	name: string
	onRequest?: (request: TReq, signal: AbortSignal) => TReq | Promise<TReq>
	// [Seam]: response hooks receive the demand-specific request (after its
	// onRequest plugins) so they can read request context — e.g. user.consent —
	// instead of relying on hidden global state.
	onResponse?: (
		bids: TBid[],
		signal: AbortSignal,
		request: TReq,
	) => TBid[] | Promise<TBid[]>
}

export interface DemandAdapter<TReq, TImp> {
	name: string
	endpoint: string | ((req: TReq) => string)
	extensions?: () => DemandExtensions
	impExt?: (item: Readonly<TImp>) => Record<string, unknown> | null
	fetchOptions?: {
		headers?: Record<string, string> | ((req: TReq) => Record<string, string>)
		contentType?: string
		transform?: (body: string) => string
	}
}

export interface DemandHandle<TReq, TBid> {
	with: (plugin: DemandPlugin<TReq, TBid>) => DemandHandle<TReq, TBid>
}

export interface BidResult<TBid> {
	requestId: string
	bids: Map<string, TBid[]>
	errors: DemandError[]
}

export interface BidOptions {
	timeout?: number
	pluginTimeout?: number
}

export interface RunnerOptions<TReq> {
	clone?: (req: TReq) => TReq
	fetcher?: typeof globalThis.fetch
	// [Seam]: injectable effects keep the pipeline deterministic in tests.
	now?: () => number
	genId?: () => string
}

export type AuctionStrategy<TBid> = (bids: TBid[]) => TBid | null

export interface AdSlots<TReq, TBid, TImp> {
	use: (plugin: Plugin<TReq, TBid>) => void
	demand: (adapter: DemandAdapter<TReq, TImp>) => DemandHandle<TReq, TBid>
	bid: (options?: BidOptions) => Promise<BidResult<TBid>>
}
