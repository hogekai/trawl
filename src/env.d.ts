declare global {
	interface AbortSignal {
		readonly aborted: boolean
		readonly reason: unknown
		addEventListener(type: "abort", listener: () => void): void
		removeEventListener(type: "abort", listener: () => void): void
	}

	const AbortSignal: {
		timeout(ms: number): AbortSignal
	}

	class AbortController {
		readonly signal: AbortSignal
		abort(reason?: unknown): void
	}

	const crypto: {
		randomUUID(): string
	}

	function structuredClone<T>(value: T): T

	function fetch(input: string | URL, init?: Record<string, unknown>): Promise<Response>

	interface Response {
		readonly ok: boolean
		readonly status: number
		json(): Promise<unknown>
		text(): Promise<string>
	}
}

export {}
