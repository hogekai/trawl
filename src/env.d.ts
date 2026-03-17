declare global {
	interface AbortSignal {
		readonly aborted: boolean
		readonly reason: unknown
		addEventListener(type: "abort", listener: () => void): void
		removeEventListener(type: "abort", listener: () => void): void
	}

	function fetch(input: string | URL, init?: Record<string, unknown>): Promise<Response>

	interface Response {
		readonly ok: boolean
		readonly status: number
		json(): Promise<unknown>
		text(): Promise<string>
	}
}

export {}
