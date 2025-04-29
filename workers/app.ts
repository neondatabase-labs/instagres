import { and, eq, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import pMap from "p-map";
import { createRequestHandler } from "react-router";
import { databasesTable } from "~/db/schema";
import neonApiClient from "~/lib/neonApiClient";

declare module "react-router" {
	export interface AppLoadContext extends ReturnType<typeof buildLoadContext> {}
}

const handler = createRequestHandler(
	// @ts-expect-error - virtual module provided by React Router at build time
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

const buildLoadContext = (env: CloudflareWorkerEnv) => ({
	db: drizzle(env.DATABASE_URL),
	TURNSTILE_SITE_KEY: env.TURNSTILE_SITE_KEY,
	TURNSTILE_SECRET_KEY: env.TURNSTILE_SECRET_KEY,
	neon: neonApiClient(env.NEON_API_KEY),
	env,
});

export default {
	fetch: async (req, env) => {
		const ipAddress = req.headers.get("cf-connecting-ip") || "unknown";
		const { success } = await env.RATE_LIMITER.limit({ key: ipAddress });
		if (!success) return new Response("Rate limit exceeded", { status: 429 });

		return handler(req, buildLoadContext(env));
	},

	scheduled: async (_, env) => {
		if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
		if (!env.NEON_API_KEY) throw new Error("NEON_API_KEY is not set");
		const db = drizzle(env.DATABASE_URL);
		const neon = neonApiClient(env.NEON_API_KEY);

		const projectsToDelete = await db
			.select({ project_id: databasesTable.neonProjectId })
			.from(databasesTable)
			.where(
				and(
					lt(databasesTable.createdAt, sql`now() - interval '1 hour'`),
					eq(databasesTable.claimStatus, "UNCLAIMED"),
				),
			);

		await pMap(
			projectsToDelete,
			({ project_id }) =>
				neon
					.DELETE("/projects/{project_id}", {
						params: { path: { project_id } },
					})
					.catch((err) =>
						console.log("Warning: failed to delete project", project_id, err),
					),
			{ concurrency: 50 },
		);

		await db
			.delete(databasesTable)
			.where(lt(databasesTable.createdAt, sql`now() - interval '1 hour'`));
	},
} satisfies ExportedHandler<CloudflareWorkerEnv>;
