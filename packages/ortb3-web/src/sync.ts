import type { DemandPlugin } from "@trawl/ortb3"
import type { Bid, Request } from "iab-openrtb/v30"

export function sync(
	type: "image" | "iframe",
	buildUrl: (consent?: string) => string,
): DemandPlugin {
	return {
		name: "sync",
		onResponse(bids: Bid[], _signal: AbortSignal, request: Request): Bid[] {
			// [Seam]: read the TCF consent string the consent() plugin wrote
			// onto the request, so the sync URL can carry it downstream.
			const consent = request.context?.user?.consent
			const url = buildUrl(consent)
			if (type === "image") {
				new Image().src = url
			} else {
				const iframe = document.createElement("iframe")
				iframe.src = url
				iframe.width = "0"
				iframe.height = "0"
				iframe.style.display = "none"
				document.body.appendChild(iframe)
			}
			return bids
		},
	}
}
