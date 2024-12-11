import { lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { createRequestHandler } from "react-router";
import { databasesTable } from "~/db/schema";
import neonApiClient from "~/lib/neonApiClient";

declare module "react-router" {
	export interface AppLoadContext {
		db: ReturnType<typeof drizzle>;
		TURNSTILE_SITE_KEY: string;
		TURNSTILE_SECRET_KEY: string;
		neon: ReturnType<typeof neonApiClient>;
	}
}

const handler = createRequestHandler(
	// @ts-expect-error - virtual module provided by React Router at build time
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

interface CloudflareWorkerEnv {
	DATABASE_URL?: string;
	TURNSTILE_SITE_KEY?: string;
	TURNSTILE_SECRET_KEY?: string;
	NEON_API_KEY?: string;
	RATE_LIMITER: RateLimit;
}

export default {
	fetch: async (req, env) => {
		const ipAddress = req.headers.get("cf-connecting-ip") || "unknown";
		const { success } = await env.RATE_LIMITER.limit({ key: ipAddress });
		if (!success) return new Response("Rate limit exceeded", { status: 429 });

		if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
		if (!env.TURNSTILE_SITE_KEY)
			throw new Error("TURNSTILE_SITE_KEY is not set");
		if (!env.TURNSTILE_SECRET_KEY)
			throw new Error("TURNSTILE_SECRET_KEY is not set");
		if (!env.NEON_API_KEY) throw new Error("NEON_API_KEY is not set");

		return handler(req, {
			db: drizzle(env.DATABASE_URL),
			TURNSTILE_SITE_KEY: env.TURNSTILE_SITE_KEY,
			TURNSTILE_SECRET_KEY: env.TURNSTILE_SECRET_KEY,
			neon: neonApiClient(env.NEON_API_KEY),
		});
	},

	scheduled: async (_, env) => {
		if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
		if (!env.NEON_API_KEY) throw new Error("NEON_API_KEY is not set");
		const db = drizzle(env.DATABASE_URL);
		const neon = neonApiClient(env.NEON_API_KEY);

		const databases = await db
			.select({ project_id: databasesTable.neonProjectId })
			.from(databasesTable)
			.where(lt(databasesTable.createdAt, sql`now() - interval '1 hour'`));

		await Promise.all(
			databases.map(({ project_id }) =>
				neon.DELETE("/projects/{project_id}", {
					params: { path: { project_id } },
				}),
			),
		);

		await db
			.delete(databasesTable)
			.where(lt(databasesTable.createdAt, sql`now() - interval '1 hour'`));
	},
} satisfies ExportedHandler<CloudflareWorkerEnv>;
