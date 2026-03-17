declare global {
	interface AbortSignal {
		readonly aborted: boolean
		readonly reason: unknown
		addEventListener(type: "abort", listener: () => void): void
		removeEventListener(type: "abort", listener: () => void): void
	}

	class AbortController {
		readonly signal: AbortSignal
		abort(reason?: unknown): void
	}

	class Image {
		src: string
	}

	const document: {
		createElement(tag: "iframe"): HTMLIFrameElement
		body: { appendChild(node: unknown): void }
		browsingTopics(): Promise<BrowsingTopic[]>
	}

	interface HTMLIFrameElement {
		src: string
		width: string
		height: string
		style: { display: string }
	}

	interface BrowsingTopic {
		topic: number
		version: string
		configVersion: string
		modelVersion: string
		taxonomyVersion: string
	}
}

export {}
