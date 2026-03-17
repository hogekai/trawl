import type { Item, Bid, Request } from "iab-openrtb/v30"
import type { Placement } from "iab-adcom/placement"

export type { Bid, Item, Request, Placement }

export interface TrawlBidExt {
	demandName: string
	fetchedAt: number
}

export interface DemandError {
	requestId: string
	demandName: string
	type: "timeout" | "network" | "parse" | "validation" | "unknown"
	message: string
}

export interface BidResult {
	requestId: string
	bids: Map<string, Bid[]>
	errors: DemandError[]
}

export interface Plugin {
	name: string
	onRequest?: (request: Request, signal: AbortSignal) => Request | Promise<Request>
	onResponse?: (bids: Bid[], signal: AbortSignal) => Bid[] | Promise<Bid[]>
}

export interface DemandPlugin {
	name: string
	onRequest?: (request: Request, signal: AbortSignal) => Request | Promise<Request>
	onResponse?: (bids: Bid[], signal: AbortSignal) => Bid[] | Promise<Bid[]>
}

export interface DemandExtensions {
	impExt?: (item: Readonly<Item>) => Record<string, unknown> | undefined
	requestExt?: () => Record<string, unknown> | undefined
}

export interface DemandAdapter {
	name: string
	fetchBids: (request: Request, signal: AbortSignal, fetcher?: typeof globalThis.fetch) => Promise<Bid[]>
	extensions?: DemandExtensions
}

export interface DemandHandle {
	with: (plugin: DemandPlugin) => DemandHandle
}

export interface BidOptions {
	timeout?: number
	pluginTimeout?: number
	clone?: boolean
	fetcher?: typeof globalThis.fetch
}

export type AuctionStrategy = (bids: Bid[]) => Bid | null

export interface AdSlots {
	use: (plugin: Plugin) => void
	demand: (adapter: DemandAdapter) => DemandHandle
	bid: (options?: BidOptions) => Promise<BidResult>
}
