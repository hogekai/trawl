import { merge } from "@trawl/core"
import type { Audio, Banner, Imp, Video } from "iab-openrtb/v26"

type PartialImp = Partial<Imp>

type BannerOptions = Omit<Partial<Banner>, "format">

type VideoParams = {
	mimes: string[]
} & Omit<Partial<Video>, "mimes">

type AudioParams = {
	mimes: string[]
} & Omit<Partial<Audio>, "mimes">

export function imp(id: string, ...fragments: PartialImp[]): Imp {
	const merged = {} as Imp
	for (const f of fragments) {
		merge(
			merged as unknown as Record<string, unknown>,
			f as Record<string, unknown>,
		)
	}
	return { ...merged, id }
}

export function banner(
	sizes: [number, number][],
	options?: BannerOptions,
): PartialImp {
	if (sizes.length === 0) {
		throw new Error("banner() requires at least one size")
	}
	return {
		banner: {
			...options,
			format: sizes.map(([w, h]) => ({ w, h })),
		},
	}
}

export function video(params: VideoParams): PartialImp {
	return { video: params as Video }
}

export function audio(params: AudioParams): PartialImp {
	return { audio: params as Audio }
}

/**
 * Native impression. In OpenRTB 2.x the native markup request is a
 * JSON-encoded string; pass the request object (it will be stringified) or a
 * pre-built string.
 */
export function native(
	request: string | Record<string, unknown>,
	ver = "1.2",
): PartialImp {
	return {
		native: {
			request: typeof request === "string" ? request : JSON.stringify(request),
			ver,
		},
	}
}
