import { createRunner } from "@trawl/core"
import type { Imp } from "iab-openrtb/v26"
import { ortb2Profile } from "./profile.js"
import type { AdSlots, AdSlotsOptions } from "./types.js"

export function createAdSlots(imps: Imp[], options?: AdSlotsOptions): AdSlots {
	return createRunner(ortb2Profile(options), imps, {
		clone: options?.clone,
		fetcher: options?.fetcher,
	})
}
