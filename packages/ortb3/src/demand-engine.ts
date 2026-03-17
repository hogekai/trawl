import type { Item, Openrtb, Request } from "iab-openrtb/v30"
import { merge } from "./merge.js"
import type { DemandAdapter, DemandError } from "./types.js"

export interface DemandBuildResult {
	request: Request
	requestInit: { method: string; headers: Record<string, string>; body: string }
	endpoint: string
}

export interface DemandSkipped {
	reason: "all-items-null"
}

export type BuildResult =
	| { ok: true; value: DemandBuildResult }
	| { ok: true; skipped: true; value: DemandSkipped }
	| { ok: false; error: DemandError }

export function buildDemandRequest(
	req: Request,
	adapter: DemandAdapter,
): BuildResult {
	Object.freeze(req.item)

	// extensions
	if (adapter.extensions) {
		let exts
		try {
			exts = adapter.extensions()
		} catch (e) {
			return {
				ok: false,
				error: {
					requestId: req.id,
					demandName: adapter.name,
					type: "invalid",
					message: e instanceof Error ? e.message : String(e),
				},
			}
		}

		if (exts.request) {
			req.ext ??= {}
			merge(req.ext, exts.request)
		}
		if (exts.site) {
			req.context ??= {}
			req.context.site ??= {}
			req.context.site.ext ??= {}
			merge(req.context.site.ext, exts.site)
		}
		if (exts.user) {
			req.context ??= {}
			req.context.user ??= {}
			req.context.user.ext ??= {}
			merge(req.context.user.ext, exts.user)
		}
		if (exts.device) {
			req.context ??= {}
			req.context.device ??= {}
			req.context.device.ext ??= {}
			merge(req.context.device.ext, exts.device)
		}
		if (exts.regs) {
			req.context ??= {}
			req.context.regs ??= {}
			req.context.regs.ext ??= {}
			merge(req.context.regs.ext, exts.regs)
		}
	}

	// impExt
	const filteredItems: Item[] = []
	for (const item of req.item) {
		if (!adapter.impExt) {
			filteredItems.push(item)
			continue
		}
		let ext: Record<string, unknown> | null
		try {
			ext = adapter.impExt(item)
		} catch (e) {
			return {
				ok: false,
				error: {
					requestId: req.id,
					demandName: adapter.name,
					type: "invalid",
					message: e instanceof Error ? e.message : String(e),
				},
			}
		}
		if (ext === null) continue
		item.ext ??= {}
		merge(item.ext, ext)
		filteredItems.push(item)
	}

	if (filteredItems.length === 0) {
		return { ok: true, skipped: true, value: { reason: "all-items-null" } }
	}
	// replace frozen item array with filtered
	;(req as { item: Item[] }).item = filteredItems

	// endpoint
	const endpoint =
		typeof adapter.endpoint === "function"
			? adapter.endpoint(req)
			: adapter.endpoint

	// requestInit
	const headers: Record<string, string> =
		typeof adapter.fetchOptions?.headers === "function"
			? adapter.fetchOptions.headers(req)
			: { ...adapter.fetchOptions?.headers }

	headers["Content-Type"] =
		adapter.fetchOptions?.contentType ?? "application/json"

	const envelope: Openrtb = {
		ver: "3.0",
		domainspec: "adcom",
		domainver: "1.0",
		request: req,
	}
	let body = JSON.stringify(envelope)
	if (adapter.fetchOptions?.transform) {
		body = adapter.fetchOptions.transform(body)
	}

	return {
		ok: true,
		value: {
			request: req,
			requestInit: { method: "POST", headers, body },
			endpoint,
		},
	}
}
