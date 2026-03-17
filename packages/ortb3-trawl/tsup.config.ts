import { defineConfig } from "tsup"

export default defineConfig({
	entry: ["src/index.ts", "src/web/index.ts"],
	format: ["esm"],
	dts: true,
	target: "es2022",
	clean: true,
})
