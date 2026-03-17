import type { Bid, Item, Request } from "iab-openrtb/v30"
import { buildDemandRequest } from "./demand-engine.js"
import { parseResponse } from "./parse-response.js"
import {
	runDemandRequestPlugins,
	runDemandResponsePlugins,
	runGlobalRequestPlugins,
	runGlobalResponsePlugins,
} from "./plugin-engine.js"
import type {
	AdSlots,
	AdSlotsOptions,
	BidOptions,
	BidResult,
	DemandAdapter,
	DemandError,
	DemandHandle,
	DemandPlugin,
	Plugin,
	TrawlBidExt,
} from "./types.js"

interface DemandEntry {
	adapter: DemandAdapter
	plugins: DemandPlugin[]
}

interface DemandResult {
	demandName: string
	bids: Bid[]
	plugins: readonly DemandPlugin[]
	errors: DemandError[]
}

export function createAdSlots(
	items: Item[],
	options?: AdSlotsOptions,
): AdSlots {
	const ids = new Set<string>()
	for (const item of items) {
		if (ids.has(item.id)) {
			throw new Error(`Duplicate imp id: "${item.id}"`)
		}
		ids.add(item.id)
	}

	const globalPlugins: Plugin[] = []
	const demands: DemandEntry[] = []

	const cloneFn = options?.clone ?? structuredClone
	const fetchFn = options?.fetcher ?? globalThis.fetch

	const use = (plugin: Plugin): void => {
		globalPlugins.push(plugin)
	}

	const demand = (adapter: DemandAdapter): DemandHandle => {
		const entry: DemandEntry = { adapter, plugins: [] }
		demands.push(entry)

		const handle: DemandHandle = {
			with(plugin: DemandPlugin): DemandHandle {
				entry.plugins.push(plugin)
				return handle
			},
		}
		return handle
	}

	const bid = async (bidOptions?: BidOptions): Promise<BidResult> => {
		const timeout = bidOptions?.timeout ?? 1500
		const pluginTimeout = bidOptions?.pluginTimeout ?? 3000

		const requestId = crypto.randomUUID()
		const allErrors: DemandError[] = []

		// Build template request
		let templateReq: Request = { id: requestId, item: items }
		Object.freeze(templateReq.item)

		// Phase 1: Global request plugins
		const globalReqResult = await runGlobalRequestPlugins(
			globalPlugins,
			templateReq,
			pluginTimeout,
		)
		templateReq = globalReqResult.request
		allErrors.push(...globalReqResult.errors)

		// Phase 2: Fan out to all demands in parallel
		const demandResults = await Promise.allSettled(
			demands.map(async (entry): Promise<DemandResult> => {
				const { adapter, plugins: demandPlugins } = entry
				const demandName = adapter.name
				const errors: DemandError[] = []
				const signal = AbortSignal.timeout(timeout)

				// a) Clone the template
				const reqCopy = cloneFn(templateReq)

				// b) Demand-specific request plugins
				const pluginResult = await runDemandRequestPlugins(
					demandPlugins,
					reqCopy,
					signal,
					demandName,
				)
				errors.push(...pluginResult.errors)

				// c) Build the demand request
				const buildResult = buildDemandRequest(pluginResult.request, adapter)
				if (!buildResult.ok) {
					errors.push(buildResult.error)
					return { demandName, bids: [], plugins: demandPlugins, errors }
				}
				if ("skipped" in buildResult) {
					return { demandName, bids: [], plugins: demandPlugins, errors }
				}

				// d) Fetch
				const { endpoint, requestInit } = buildResult.value
				let response: Response
				try {
					response = await fetchFn(endpoint, {
						...requestInit,
						signal,
					})
				} catch (e) {
					const type = signal.aborted
						? ("timeout" as const)
						: e instanceof TypeError
							? ("network" as const)
							: ("unknown" as const)
					errors.push({
						requestId,
						demandName,
						type,
						message: e instanceof Error ? e.message : String(e),
					})
					return { demandName, bids: [], plugins: demandPlugins, errors }
				}

				// e) Parse response
				const parseResult = await parseResponse(response, demandName, requestId)
				if (!parseResult.ok) {
					errors.push(parseResult.error)
					return { demandName, bids: [], plugins: demandPlugins, errors }
				}

				return {
					demandName,
					bids: parseResult.bids,
					plugins: demandPlugins,
					errors,
				}
			}),
		)

		// Collect results from settled promises
		const successfulDemands: DemandResult[] = []
		for (const result of demandResults) {
			if (result.status === "fulfilled") {
				successfulDemands.push(result.value)
			} else {
				allErrors.push({
					requestId,
					demandName: "unknown",
					type: "unknown",
					message:
						result.reason instanceof Error
							? result.reason.message
							: String(result.reason),
				})
			}
		}

		// Phase 4: Demand response plugins (per-demand, in parallel)
		const responseResults = await Promise.allSettled(
			successfulDemands.map(async (dr) => {
				const { bids, errors } = await runDemandResponsePlugins(
					dr.plugins,
					dr.bids,
					pluginTimeout,
					dr.demandName,
					requestId,
				)
				return {
					demandName: dr.demandName,
					bids,
					errors: [...dr.errors, ...errors],
				}
			}),
		)

		// Build intermediate bids + collect errors
		const allBidsFlat: Bid[] = []
		for (const result of responseResults) {
			if (result.status === "fulfilled") {
				const { bids, errors } = result.value
				allBidsFlat.push(...bids)
				allErrors.push(...errors)
			}
		}

		// Phase 5: Global response plugins
		const globalRespResult = await runGlobalResponsePlugins(
			globalPlugins,
			allBidsFlat,
			pluginTimeout,
			requestId,
		)
		allErrors.push(...globalRespResult.errors)

		// Rebuild Map from post-plugin bids using ext.trawl.demandName
		const finalMap = new Map<string, Bid[]>()
		for (const bid of globalRespResult.bids) {
			const trawl = (bid.ext as Record<string, unknown> | undefined)?.trawl as
				| TrawlBidExt
				| undefined
			const key = trawl?.demandName ?? "unknown"
			const arr = finalMap.get(key)
			if (arr) {
				arr.push(bid)
			} else {
				finalMap.set(key, [bid])
			}
		}

		return { requestId, bids: finalMap, errors: allErrors }
	}

	return { use, demand, bid }
}
