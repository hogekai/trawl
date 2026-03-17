export function raceSignal<T>(
	promise: Promise<T>,
	signal: AbortSignal,
): Promise<T> {
	if (signal.aborted) return Promise.reject(signal.reason)

	return new Promise<T>((resolve, reject) => {
		const onAbort = () => reject(signal.reason)
		signal.addEventListener("abort", onAbort)
		promise.then(
			(v) => {
				signal.removeEventListener("abort", onAbort)
				resolve(v)
			},
			(e) => {
				signal.removeEventListener("abort", onAbort)
				reject(e)
			},
		)
	})
}
