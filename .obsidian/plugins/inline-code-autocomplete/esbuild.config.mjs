import esbuild from "esbuild";
import { builtinModules } from "node:module";

const watch = process.argv[2] === "watch";

const ctx = await esbuild.context({
	entryPoints: ["main.ts"],
	bundle: true,
	external: [
		"obsidian",
		"electron",
		"@codemirror/autocomplete",
		"@codemirror/collab",
		"@codemirror/commands",
		"@codemirror/language",
		"@codemirror/lint",
		"@codemirror/search",
		"@codemirror/state",
		"@codemirror/view",
		"@lezer/common",
		"@lezer/highlight",
		"@lezer/lr",
		...builtinModules,
	],
	format: "cjs",
	target: "es2018",
	logLevel: "info",
	sourcemap: watch ? "inline" : false,
	treeShaking: true,
	minify: !watch,
	outfile: "main.js",
});

if (watch) {
	await ctx.watch();
} else {
	await ctx.rebuild();
	process.exit(0);
}
