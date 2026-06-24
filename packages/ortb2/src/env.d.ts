declare global {
	interface MinimalRequestInit {
		method?: string
		headers?: Record<string, string>
		body?: string
		signal?: AbortSignal
	}

	function fetch(
		input: string | URL,
		init?: MinimalRequestInit,
	): Promise<Response>

	interface Response {
		readonly ok: boolean
		readonly status: number
		json(): Promise<unknown>
		text(): Promise<string>
	}
}

export {}
