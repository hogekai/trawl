import type { Placement } from "iab-adcom/placement"
import type { Bid, Item, Request } from "iab-openrtb/v30"

export type { Bid, Item, Request, Placement }

export interface TrawlBidExt {
	demandName: string
	fetchedAt: number
}

export interface DemandError {
	requestId: string
	demandName: string
	type: "timeout" | "network" | "parse" | "validation" | "invalid" | "unknown"
	message: string
}

export interface BidResult {
	requestId: string
	bids: Map<string, Bid[]>
	errors: DemandError[]
}

export interface Plugin {
	name: string
	onRequest?: (
		request: Request,
		signal: AbortSignal,
	) => Request | Promise<Request>
	onResponse?: (bids: Bid[], errors: readonly DemandError[], signal: AbortSignal) => Bid[] | Promise<Bid[]>
}

export interface DemandPlugin {
	name: string
	onRequest?: (
		request: Request,
		signal: AbortSignal,
	) => Request | Promise<Request>
	onResponse?: (bids: Bid[], signal: AbortSignal) => Bid[] | Promise<Bid[]>
}

export interface DemandExtensions {
	request?: Record<string, unknown>
	site?: Record<string, unknown>
	user?: Record<string, unknown>
	device?: Record<string, unknown>
	regs?: Record<string, unknown>
}

export interface DemandAdapter {
	name: string
	endpoint: string | ((req: Request) => string)
	extensions?: () => DemandExtensions
	impExt?: (item: Readonly<Item>) => Record<string, unknown> | null
	fetchOptions?: {
		headers?:
			| Record<string, string>
			| ((req: Request) => Record<string, string>)
		contentType?: string
		transform?: (body: string) => string
	}
}

export interface DemandHandle {
	with: (plugin: DemandPlugin) => DemandHandle
}

export interface AdSlotsOptions {
	clone?: (req: Request) => Request
	fetcher?: typeof globalThis.fetch
}

export interface BidOptions {
	timeout?: number
	pluginTimeout?: number
}

export type AuctionStrategy = (bids: Bid[]) => Bid | null

export interface AdSlots {
	use: (plugin: Plugin) => void
	demand: (adapter: DemandAdapter) => DemandHandle
	bid: (options?: BidOptions) => Promise<BidResult>
}
