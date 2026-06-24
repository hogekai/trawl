import { merge } from "./merge.js"
import type { DemandAdapter, DemandError } from "./types.js"
import type { ContextKey, VersionProfile } from "./version-profile.js"

export interface DemandBuildResult<TReq> {
	request: TReq
	requestInit: {
		method: string
		headers: Record<string, string>
		body: string
	}
	endpoint: string
}

export interface DemandSkipped {
	reason: "all-items-null"
}

export type BuildResult<TReq> =
	| { ok: true; value: DemandBuildResult<TReq> }
	| { ok: true; skipped: true; value: DemandSkipped }
	| { ok: false; error: DemandError }

const CONTEXT_KEYS: readonly ContextKey[] = ["site", "user", "device", "regs"]

function invalid(
	requestId: string,
	demandName: string,
	err: unknown,
): { ok: false; error: DemandError } {
	return {
		ok: false,
		error: {
			requestId,
			demandName,
			type: "invalid",
			message: err instanceof Error ? err.message : String(err),
		},
	}
}

export function buildDemandRequest<TReq extends { id: string }, TBid, TImp>(
	req: TReq,
	adapter: DemandAdapter<TReq, TImp>,
	profile: VersionProfile<TReq, TBid, TImp>,
): BuildResult<TReq> {
	profile.freezeImps(req)

	// extensions → request/site/user/device/regs ext (paths are version-specific)
	if (adapter.extensions) {
		let exts: ReturnType<NonNullable<typeof adapter.extensions>>
		try {
			exts = adapter.extensions()
		} catch (e) {
			return invalid(req.id, adapter.name, e)
		}

		if (exts.request) merge(profile.requestExt(req), exts.request)
		for (const key of CONTEXT_KEYS) {
			const ext = exts[key]
			if (ext) merge(profile.contextExt(req, key), ext)
		}
	}

	// impExt → per-impression ext; returning null drops the impression
	const filtered: TImp[] = []
	for (const imp of profile.getImps(req)) {
		if (!adapter.impExt) {
			filtered.push(imp)
			continue
		}
		let ext: Record<string, unknown> | null
		try {
			ext = adapter.impExt(imp)
		} catch (e) {
			return invalid(req.id, adapter.name, e)
		}
		if (ext === null) continue
		merge(profile.impExt(imp), ext)
		filtered.push(imp)
	}

	if (filtered.length === 0) {
		return { ok: true, skipped: true, value: { reason: "all-items-null" } }
	}
	profile.setImps(req, filtered)

	const endpoint =
		typeof adapter.endpoint === "function"
			? adapter.endpoint(req)
			: adapter.endpoint

	const headers: Record<string, string> =
		typeof adapter.fetchOptions?.headers === "function"
			? adapter.fetchOptions.headers(req)
			: { ...adapter.fetchOptions?.headers }
	headers["Content-Type"] =
		adapter.fetchOptions?.contentType ?? "application/json"

	let body = JSON.stringify(profile.frame(req))
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
