import type {
	AdSlots as CoreAdSlots,
	AuctionStrategy as CoreAuctionStrategy,
	BidResult as CoreBidResult,
	DemandAdapter as CoreDemandAdapter,
	DemandHandle as CoreDemandHandle,
	DemandPlugin as CoreDemandPlugin,
	Plugin as CorePlugin,
} from "@trawl/core"
import type { Bid, BidRequest, Imp } from "iab-openrtb/v26"

export type { Bid, BidRequest, Imp }
export type {
	BidOptions,
	DemandError,
	DemandExtensions,
	TrawlBidExt,
} from "@trawl/core"

// OpenRTB 2.6 instantiations of the version-agnostic core contracts. Binding the
// v2.6 BidRequest/Bid/Imp here keeps the API symmetric with @trawl/ortb3 while
// making a v2.6 plugin structurally unassignable to a v3.0 slot (BidRequest has
// top-level `imp`, no `context`/`item`).
export type Plugin = CorePlugin<BidRequest, Bid>
export type DemandPlugin = CoreDemandPlugin<BidRequest, Bid>
export type DemandAdapter = CoreDemandAdapter<BidRequest, Imp>
export type DemandHandle = CoreDemandHandle<BidRequest, Bid>
export type BidResult = CoreBidResult<Bid>
export type AuctionStrategy = CoreAuctionStrategy<Bid>
export type AdSlots = CoreAdSlots<BidRequest, Bid, Imp>

export interface AdSlotsOptions {
	clone?: (req: BidRequest) => BidRequest
	fetcher?: typeof globalThis.fetch
	request?: Partial<Omit<BidRequest, "id" | "imp">>
}
