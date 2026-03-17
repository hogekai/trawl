function isObject(val: unknown): val is Record<string, unknown> {
	return typeof val === "object" && val !== null && !Array.isArray(val)
}

export function merge<T extends Record<string, unknown>>(
	target: T,
	source: Record<string, unknown>,
): T {
	for (const key of Object.keys(source)) {
		const sourceVal = source[key]
		if (sourceVal === undefined) continue

		const targetVal = (target as Record<string, unknown>)[key]
		if (isObject(sourceVal) && isObject(targetVal)) {
			merge(targetVal, sourceVal)
		} else {
			;(target as Record<string, unknown>)[key] = sourceVal
		}
	}
	return target
}
