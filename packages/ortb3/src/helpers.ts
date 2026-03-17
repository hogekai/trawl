import type {
	DataAssetFormat,
	DisplayPlacement,
	ImageAssetFormat,
	Placement,
	TitleAssetFormat,
	VideoPlacement,
} from "iab-adcom/placement"
import type { Item } from "iab-openrtb/v30"
import { merge } from "./merge.js"

type PartialPlacement = Partial<Placement>

type BannerOptions = Omit<Partial<DisplayPlacement>, "displayfmt" | "nativefmt">

type VideoParams = {
	mimes: string[]
} & Omit<Partial<VideoPlacement>, "mime">

interface NativeAsset {
	req?: 0 | 1
	title?: TitleAssetFormat
	img?: ImageAssetFormat
	video?: VideoPlacement
	data?: DataAssetFormat
}

export function item(id: string, ...placements: PartialPlacement[]): Item {
	const spec = {} as Placement
	for (const p of placements) {
		merge(spec as Record<string, unknown>, p as Record<string, unknown>)
	}
	return { id, spec }
}

export function banner(
	sizes: [number, number][],
	options?: BannerOptions,
): PartialPlacement {
	if (sizes.length === 0) {
		throw new Error("banner() requires at least one size")
	}
	return {
		display: {
			...options,
			displayfmt: sizes.map(([w, h]) => ({ w, h })),
		},
	}
}

export function video(params: VideoParams): PartialPlacement {
	const { mimes, ...rest } = params
	return {
		video: { mime: mimes, ...rest },
	}
}

export function native(assets: NativeAsset[]): PartialPlacement {
	return {
		display: {
			nativefmt: {
				asset: assets.map((a, i) => ({ id: i, ...a })),
			},
		},
	}
}
