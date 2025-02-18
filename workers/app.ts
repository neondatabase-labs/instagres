import { AwsClient } from "aws4fetch";
import { lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { discovery } from "openid-client";
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

interface DevEnv {
	DEV_WEBHOOK_ORIGIN?: string;
}

const buildLoadContext = (env: CloudflareWorkerEnv & DevEnv) => ({
	db: drizzle(env.DATABASE_URL),
	TURNSTILE_SITE_KEY: env.TURNSTILE_SITE_KEY,
	TURNSTILE_SECRET_KEY: env.TURNSTILE_SECRET_KEY,
	neon: neonApiClient(env.NEON_API_KEY),
	getNeonOAuthConfig: () =>
		discovery(
			new URL("https://oauth2.neon.tech"),
			env.NEON_OAUTH_ID,
			env.NEON_OAUTH_SECRET,
		),
	aws: {
		client: new AwsClient({
			accessKeyId: env.AWS_ACCESS_KEY_ID,
			secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
			region: env.AWS_REGION,
		}),
		LAMBDA_FN_API: `https://lambda.${env.AWS_REGION}.amazonaws.com/2015-03-31/functions`,
	},
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

		const databases = await db
			.select({ project_id: databasesTable.neonProjectId })
			.from(databasesTable)
			.where(lt(databasesTable.createdAt, sql`now() - interval '1 hour'`));

		await pMap(
			databases,
			({ project_id }) =>
				neon.DELETE("/projects/{project_id}", {
					params: { path: { project_id } },
				}),
			{ concurrency: 50 },
		);

		await db
			.delete(databasesTable)
			.where(lt(databasesTable.createdAt, sql`now() - interval '1 hour'`));
	},
} satisfies ExportedHandler<CloudflareWorkerEnv>;
