export { createAdSlots } from "./create-ad-slots.js"
export { imp, banner, video, audio, native } from "./helpers.js"
export { auction, byPrice, byDeal } from "./auction.js"

export type {
	Bid,
	BidRequest,
	Imp,
	TrawlBidExt,
	BidResult,
	DemandError,
	DemandExtensions,
	Plugin,
	DemandPlugin,
	DemandAdapter,
	DemandHandle,
	BidOptions,
	AdSlotsOptions,
	AdSlots,
	AuctionStrategy,
} from "./types.js"
