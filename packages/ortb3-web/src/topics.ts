import type { Request } from "iab-openrtb/v30"
import type { Plugin } from "@trawl/ortb3"
import { raceSignal } from "./race-signal.js"

export function topics(): Plugin {
	return {
		name: "topics",
		async onRequest(request: Request, signal: AbortSignal): Promise<Request> {
			if (
				typeof document === "undefined" ||
				typeof document.browsingTopics !== "function"
			) {
				return request
			}

			const browsingTopics = await raceSignal(document.browsingTopics(), signal)

			request.context ??= {}
			request.context.user ??= {}
			request.context.user.ext ??= {}
			request.context.user.ext.browsing_topics = browsingTopics

			return request
		},
	}
}
