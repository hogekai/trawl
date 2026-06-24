import type {
	AdSlots as CoreAdSlots,
	AuctionStrategy as CoreAuctionStrategy,
	BidResult as CoreBidResult,
	DemandAdapter as CoreDemandAdapter,
	DemandHandle as CoreDemandHandle,
	DemandPlugin as CoreDemandPlugin,
	Plugin as CorePlugin,
} from "@trawl/core"
import type { Placement } from "iab-adcom/placement"
import type { Bid, Item, Request } from "iab-openrtb/v30"

export type { Bid, Item, Request, Placement }
export type {
	BidOptions,
	DemandError,
	DemandExtensions,
	TrawlBidExt,
} from "@trawl/core"

// OpenRTB 3.0 instantiations of the version-agnostic core contracts. Binding
// the v3.0 Request/Bid/Item here keeps the public surface identical to the
// pre-core API and makes a v2.6 plugin structurally unassignable to a v3.0 slot.
export type Plugin = CorePlugin<Request, Bid>
export type DemandPlugin = CoreDemandPlugin<Request, Bid>
export type DemandAdapter = CoreDemandAdapter<Request, Item>
export type DemandHandle = CoreDemandHandle<Request, Bid>
export type BidResult = CoreBidResult<Bid>
export type AuctionStrategy = CoreAuctionStrategy<Bid>
export type AdSlots = CoreAdSlots<Request, Bid, Item>

export interface AdSlotsOptions {
	clone?: (req: Request) => Request
	fetcher?: typeof globalThis.fetch
	request?: Partial<Omit<Request, "id" | "item">>
	openrtb?: {
		ver?: string
		domainspec?: string
		domainver?: string
	}
}
