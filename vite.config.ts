import { vitePluginViteNodeMiniflare } from "@hiogawa/vite-node-miniflare";
import { reactRouter } from "@react-router/dev/vite";
import autoprefixer from "autoprefixer";
import { resolve } from "node:path";
import tailwindcss from "tailwindcss";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ isSsrBuild }) => ({
	...(isSsrBuild && {
		build: { rollupOptions: { input: "./workers/app.ts" } },
	}),
	css: {
		postcss: {
			plugins: [tailwindcss, autoprefixer],
		},
	},
	ssr: {
		target: "webworker",
		noExternal: true,
		resolve: {
			conditions: ["workerd", "browser"],
		},
		optimizeDeps: {
			include: [
				"react",
				"react/jsx-runtime",
				"react/jsx-dev-runtime",
				"react-dom",
				"react-dom/server",
				"react-router",
			],
		},
	},
	plugins: [
		vitePluginViteNodeMiniflare({
			entry: "./workers/app.ts",
			miniflareOptions: (options) => {
				options.compatibilityDate = "2024-11-18";
				options.compatibilityFlags = ["nodejs_compat"];
				Object.assign(options.bindings || {}, process.env);
				options.ratelimits = {
					RATE_LIMITER: { simple: { limit: 100, period: 60 } },
				};
			},
		}),
		reactRouter(),
		tsconfigPaths(),
	],
	resolve: {
		alias: {
			"~": resolve(__dirname, "./app"),
		},
	},
}));
