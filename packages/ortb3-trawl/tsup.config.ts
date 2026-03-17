import { defineConfig } from "tsup"

export default defineConfig({
	entry: ["src/index.ts", "src/web/index.ts"],
	format: ["esm"],
	tsconfig: "tsconfig.build.json",
	dts: true,
	target: "es2022",
	clean: true,
})
