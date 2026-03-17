import type { Item } from "iab-openrtb/v30"
import type {
	AdSlots,
	BidOptions,
	BidResult,
	DemandAdapter,
	DemandHandle,
	DemandPlugin,
	Plugin,
} from "./types.js"

interface DemandEntry {
	adapter: DemandAdapter
	plugins: DemandPlugin[]
}

export function createAdSlots(...items: Item[]): AdSlots {
	const ids = new Set<string>()
	for (const item of items) {
		if (ids.has(item.id)) {
			throw new Error(`Duplicate imp id: "${item.id}"`)
		}
		ids.add(item.id)
	}

	const globalPlugins: Plugin[] = []
	const demands: DemandEntry[] = []

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

	const bid = async (_options?: BidOptions): Promise<BidResult> => {
		return {
			requestId: "",
			bids: new Map(),
			errors: [],
		}
	}

	return { use, demand, bid }
}
