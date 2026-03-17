import type { Item } from "iab-openrtb/v30"
import type { AssetFormat, Placement, VideoPlacement } from "iab-adcom/placement"
import type { NativeImageAssetType } from "iab-adcom/enum"

type PartialPlacement = Partial<Placement>

export function imp(id: string, ...placements: PartialPlacement[]): Item {
	const spec = Object.assign({}, ...placements) as Placement
	return { id, spec }
}

export function banner(...sizes: [number, number][]): PartialPlacement {
	if (sizes.length === 0) {
		throw new Error("banner() requires at least one size")
	}
	return {
		display: {
			displayfmt: sizes.map(([w, h]) => ({ w, h })),
		},
	}
}

export function video(params: { mimes: string[] } & Record<string, unknown>): PartialPlacement {
	const { mimes, ...rest } = params
	return {
		video: {
			mime: mimes,
			...rest,
		} as VideoPlacement,
	}
}

export function native(params: { title?: number; image?: number }): PartialPlacement {
	const assets: AssetFormat[] = []
	let assetId = 0

	if (params.title != null) {
		assets.push({ id: assetId++, title: { len: params.title } })
	}
	if (params.image != null) {
		assets.push({ id: assetId++, img: { type: params.image as NativeImageAssetType } })
	}

	return {
		display: {
			nativefmt: {
				asset: assets,
			},
		},
	}
}
