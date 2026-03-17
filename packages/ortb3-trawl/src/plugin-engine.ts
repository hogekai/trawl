import type { Bid, Request } from "iab-openrtb/v30"
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

export async function runGlobalRequestPlugins(
	plugins: readonly Plugin[],
	request: Request,
	pluginTimeout: number | undefined,
): Promise<{ request: Request; errors: DemandError[] }> {
	const signal = makeSignal(pluginTimeout)
	const { value, errors } = await runPluginsSequential(
		plugins,
		(p) => (p as Plugin).onRequest,
		request,
		signal,
		(name, err) => formatError(request.id, `plugin:${name}`, err),
	)
	return { request: value, errors }
}

export async function runDemandRequestPlugins(
	plugins: readonly DemandPlugin[],
	request: Request,
	signal: AbortSignal,
	demandName: string,
): Promise<{ request: Request; errors: DemandError[] }> {
	const { value, errors } = await runPluginsSequential(
		plugins,
		(p) => (p as DemandPlugin).onRequest,
		request,
		signal,
		(_, err) => formatError(request.id, demandName, err),
	)
	return { request: value, errors }
}

export async function runDemandResponsePlugins(
	plugins: readonly DemandPlugin[],
	bids: Bid[],
	pluginTimeout: number | undefined,
	demandName: string,
	requestId: string,
): Promise<{ bids: Bid[]; errors: DemandError[] }> {
	const signal = makeSignal(pluginTimeout)
	const { value, errors } = await runPluginsSequential(
		plugins,
		(p) => (p as DemandPlugin).onResponse,
		bids,
		signal,
		(_, err) => formatError(requestId, demandName, err),
	)
	return { bids: value, errors }
}

export async function runGlobalResponsePlugins(
	plugins: readonly Plugin[],
	bids: Bid[],
	pluginTimeout: number | undefined,
	requestId: string,
): Promise<{ bids: Bid[]; errors: DemandError[] }> {
	const signal = makeSignal(pluginTimeout)
	const { value, errors } = await runPluginsSequential(
		plugins,
		(p) => (p as Plugin).onResponse,
		bids,
		signal,
		(name, err) => formatError(requestId, `plugin:${name}`, err),
	)
	return { bids: value, errors }
}
