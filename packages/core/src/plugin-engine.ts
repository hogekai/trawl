import type { DemandError, DemandPlugin, Plugin } from "./types.js"

async function runPluginsSequential<T>(
	plugins: readonly { name: string }[],
	getHook: (plugin: { name: string }) =>
		| ((value: T, signal: AbortSignal) => T | Promise<T>)
		| undefined,
	initial: T,
	signal: AbortSignal,
	toError: (pluginName: string, err: unknown) => DemandError,
): Promise<{ value: T; errors: DemandError[] }> {
	let current = initial
	const errors: DemandError[] = []

	for (const plugin of plugins) {
		if (signal.aborted) break

		const hook = getHook(plugin)
		if (!hook) continue

		try {
			current = await hook(current, signal)
		} catch (err) {
			errors.push(toError(plugin.name, err))
		}
	}

	return { value: current, errors }
}

function makeSignal(pluginTimeout: number | undefined): AbortSignal {
	return pluginTimeout != null
		? AbortSignal.timeout(pluginTimeout)
		: new AbortController().signal
}

function formatError(
	requestId: string,
	demandName: string,
	err: unknown,
): DemandError {
	return {
		requestId,
		demandName,
		type: "invalid",
		message: err instanceof Error ? err.message : String(err),
	}
}

export async function runGlobalRequestPlugins<
	TReq extends { id: string },
	TBid,
>(
	plugins: readonly Plugin<TReq, TBid>[],
	request: TReq,
	pluginTimeout: number | undefined,
): Promise<{ request: TReq; errors: DemandError[] }> {
	const signal = makeSignal(pluginTimeout)
	const { value, errors } = await runPluginsSequential<TReq>(
		plugins,
		(p) => (p as Plugin<TReq, TBid>).onRequest,
		request,
		signal,
		(name, err) => formatError(request.id, `plugin:${name}`, err),
	)
	return { request: value, errors }
}

export async function runDemandRequestPlugins<
	TReq extends { id: string },
	TBid,
>(
	plugins: readonly DemandPlugin<TReq, TBid>[],
	request: TReq,
	signal: AbortSignal,
	demandName: string,
): Promise<{ request: TReq; errors: DemandError[] }> {
	const { value, errors } = await runPluginsSequential<TReq>(
		plugins,
		(p) => (p as DemandPlugin<TReq, TBid>).onRequest,
		request,
		signal,
		(_, err) => formatError(request.id, demandName, err),
	)
	return { request: value, errors }
}

export async function runDemandResponsePlugins<
	TReq extends { id: string },
	TBid,
>(
	plugins: readonly DemandPlugin<TReq, TBid>[],
	bids: TBid[],
	request: TReq,
	pluginTimeout: number | undefined,
	demandName: string,
	requestId: string,
): Promise<{ bids: TBid[]; errors: DemandError[] }> {
	const signal = makeSignal(pluginTimeout)
	const { value, errors } = await runPluginsSequential<TBid[]>(
		plugins,
		(p) => {
			const hook = (p as DemandPlugin<TReq, TBid>).onResponse
			if (!hook) return undefined
			return (bids: TBid[], signal: AbortSignal) => hook(bids, signal, request)
		},
		bids,
		signal,
		(_, err) => formatError(requestId, demandName, err),
	)
	return { bids: value, errors }
}

export async function runGlobalResponsePlugins<
	TReq extends { id: string },
	TBid,
>(
	plugins: readonly Plugin<TReq, TBid>[],
	bids: TBid[],
	pipelineErrors: readonly DemandError[],
	pluginTimeout: number | undefined,
	requestId: string,
): Promise<{ bids: TBid[]; errors: DemandError[] }> {
	const signal = makeSignal(pluginTimeout)
	const { value, errors } = await runPluginsSequential<TBid[]>(
		plugins,
		(p) => {
			const hook = (p as Plugin<TReq, TBid>).onResponse
			if (!hook) return undefined
			return (bids: TBid[], signal: AbortSignal) =>
				hook(bids, pipelineErrors, signal)
		},
		bids,
		signal,
		(name, err) => formatError(requestId, `plugin:${name}`, err),
	)
	return { bids: value, errors }
}
