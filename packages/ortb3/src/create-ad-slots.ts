import { createRunner } from "@trawl/core"
import type { Item } from "iab-openrtb/v30"
import { ortb3Profile } from "./profile.js"
import type { AdSlots, AdSlotsOptions } from "./types.js"

export function createAdSlots(
	items: Item[],
	options?: AdSlotsOptions,
): AdSlots {
	return createRunner(ortb3Profile(options), items, {
		clone: options?.clone,
		fetcher: options?.fetcher,
	})
}
