import { buildDemandRequest } from "./build-demand-request.js"
import { parseResponse } from "./parse-response.js"
import {
	runDemandRequestPlugins,
	runDemandResponsePlugins,
	runGlobalRequestPlugins,
	runGlobalResponsePlugins,
} from "./plugin-engine.js"
import type {
	AdSlots,
	BidOptions,
	BidResult,
	DemandAdapter,
	DemandError,
	DemandHandle,
	DemandPlugin,
	Plugin,
	RunnerOptions,
} from "./types.js"
import type { VersionProfile } from "./version-profile.js"

interface DemandEntry<TReq, TBid, TImp> {
	adapter: DemandAdapter<TReq, TImp>
	plugins: DemandPlugin<TReq, TBid>[]
}

interface DemandResult<TReq, TBid> {
	demandName: string
	bids: TBid[]
	request: TReq
	plugins: readonly DemandPlugin<TReq, TBid>[]
	errors: DemandError[]
}

/**
 * The version-agnostic bid pipeline. A {@link VersionProfile} supplies the only
 * OpenRTB-version-specific operations; everything here (plugin phases, parallel
 * fan-out, timeout/error classification, result grouping) is shared.
 */
export function createRunner<
	TReq extends { id: string },
	TBid,
	TImp extends { id: string },
>(
	profile: VersionProfile<TReq, TBid, TImp>,
	imps: TImp[],
	options: RunnerOptions<TReq> = {},
): AdSlots<TReq, TBid, TImp> {
	const ids = new Set<string>()
	for (const imp of imps) {
		if (ids.has(imp.id)) {
			throw new Error(`Duplicate item id: "${imp.id}"`)
		}
		ids.add(imp.id)
	}

	const globalPlugins: Plugin<TReq, TBid>[] = []
	const demands: DemandEntry<TReq, TBid, TImp>[] = []

	const cloneFn = options.clone ?? structuredClone
	const fetchFn = options.fetcher ?? globalThis.fetch
	const now = options.now ?? Date.now
	const genId = options.genId ?? (() => crypto.randomUUID())

	const use = (plugin: Plugin<TReq, TBid>): void => {
		globalPlugins.push(plugin)
	}

	const demand = (
		adapter: DemandAdapter<TReq, TImp>,
	): DemandHandle<TReq, TBid> => {
		const entry: DemandEntry<TReq, TBid, TImp> = { adapter, plugins: [] }
		demands.push(entry)

		const handle: DemandHandle<TReq, TBid> = {
			with(plugin: DemandPlugin<TReq, TBid>): DemandHandle<TReq, TBid> {
				entry.plugins.push(plugin)
				return handle
			},
		}
		return handle
	}

	const bid = async (bidOptions?: BidOptions): Promise<BidResult<TBid>> => {
		const timeout = bidOptions?.timeout ?? 1500
		const pluginTimeout = bidOptions?.pluginTimeout ?? 3000

		const requestId = genId()
		const allErrors: DemandError[] = []

		// Build template request
		let templateReq = profile.buildTemplateRequest(requestId, imps)

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
			demands.map(async (entry): Promise<DemandResult<TReq, TBid>> => {
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
				const buildResult = buildDemandRequest(
					pluginResult.request,
					adapter,
					profile,
				)
				if (!buildResult.ok) {
					errors.push(buildResult.error)
					return {
						demandName,
						bids: [],
						request: pluginResult.request,
						plugins: demandPlugins,
						errors,
					}
				}
				if ("skipped" in buildResult) {
					return {
						demandName,
						bids: [],
						request: pluginResult.request,
						plugins: demandPlugins,
						errors,
					}
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
					return {
						demandName,
						bids: [],
						request: buildResult.value.request,
						plugins: demandPlugins,
						errors,
					}
				}

				// e) Parse response
				const parseResult = await parseResponse(
					response,
					demandName,
					requestId,
					now,
					profile,
				)
				if (!parseResult.ok) {
					errors.push(parseResult.error)
					return {
						demandName,
						bids: [],
						request: buildResult.value.request,
						plugins: demandPlugins,
						errors,
					}
				}

				return {
					demandName,
					bids: parseResult.bids,
					request: buildResult.value.request,
					plugins: demandPlugins,
					errors,
				}
			}),
		)

		// Collect results from settled promises
		const successfulDemands: DemandResult<TReq, TBid>[] = []
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

		// Phase 3: Demand response plugins (per-demand, in parallel)
		const responseResults = await Promise.allSettled(
			successfulDemands.map(async (dr) => {
				const { bids, errors } = await runDemandResponsePlugins(
					dr.plugins,
					dr.bids,
					dr.request,
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
		const allBidsFlat: TBid[] = []
		for (const result of responseResults) {
			if (result.status === "fulfilled") {
				const { bids, errors } = result.value
				allBidsFlat.push(...bids)
				allErrors.push(...errors)
			}
		}

		// Phase 4: Global response plugins
		const globalRespResult = await runGlobalResponsePlugins(
			globalPlugins,
			allBidsFlat,
			allErrors,
			pluginTimeout,
			requestId,
		)
		allErrors.push(...globalRespResult.errors)

		// Rebuild Map keyed by impId
		const finalMap = new Map<string, TBid[]>()
		for (const bid of globalRespResult.bids) {
			const key = profile.impKeyOf(bid)
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
