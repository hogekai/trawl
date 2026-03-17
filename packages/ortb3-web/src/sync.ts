import type { Bid } from "iab-openrtb/v30"
import type { DemandPlugin } from "@trawl/ortb3"

export function sync(
	type: "image" | "iframe",
	buildUrl: (consent?: string) => string,
): DemandPlugin {
	return {
		name: "sync",
		onResponse(bids: Bid[]): Bid[] {
			const url = buildUrl()
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
