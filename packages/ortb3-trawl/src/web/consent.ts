import type { Request } from "iab-openrtb/v30"
import type { Plugin } from "../types.js"
import { raceSignal } from "./race-signal.js"

export interface TCData {
	gdprApplies: boolean
	tcString: string
}

export type GetTCData = () => Promise<TCData>

export function consent(getTCData: GetTCData): Plugin {
	return {
		name: "consent",
		async onRequest(request: Request, signal: AbortSignal): Promise<Request> {
			const tcData = await raceSignal(getTCData(), signal)

			request.context ??= {}
			request.context.regs ??= {}
			request.context.regs.ext ??= {}
			request.context.regs.ext.gdpr = tcData.gdprApplies ? 1 : 0

			request.context.user ??= {}
			request.context.user.ext ??= {}
			request.context.user.ext.consent = tcData.tcString

			return request
		},
	}
}
