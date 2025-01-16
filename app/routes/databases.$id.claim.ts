import { eq } from "drizzle-orm";
import {
	buildAuthorizationUrl,
	calculatePKCECodeChallenge,
	randomPKCECodeVerifier,
} from "openid-client";
import { createCookie, redirect } from "react-router";
import { databasesTable } from "~/db/schema";
import neonApiClient from "~/lib/neonApiClient";
import { findClosestRegion } from "~/lib/utils";
import type { Route } from "./+types/databases.$id.claim";

export const loader = async ({
	request,
	params,
	context: { db, aws, env },
}: Route.LoaderArgs) => {
	const accessToken = new URL(request.url).searchParams.get("access-token");
	if (!accessToken)
		throw new Response("Access token required", { status: 400 });
	const [database] = await db
		.select()
		.from(databasesTable)
		.where(eq(databasesTable.id, params.id));
	if (!database) throw new Response("Database not found", { status: 404 });
	if (database.claimStatus === "UNCLAIMED") {
		await db
			.update(databasesTable)
			.set({ claimStatus: "CLAIMING" })
			.where(eq(databasesTable.id, params.id));
		const userNeonClient = neonApiClient(accessToken);
		const { data, error } = await userNeonClient.POST("/projects", {
			body: {
				project: {
					pg_version: 16,
					name: `instagres-${database.id}`,
					region_id: findClosestRegion(request.headers),
				},
			},
		});
		if (error) {
			console.log(error);
			await db
				.update(databasesTable)
				.set({ claimStatus: "UNCLAIMED" })
				.where(eq(databasesTable.id, params.id));
			throw new Response(
				"Failed to claim database - failed to create Neon project",
				{
					status: 500,
				},
			);
		}
		const destUrl = data?.connection_uris[0]?.connection_uri;
		if (!destUrl) {
			await db
				.update(databasesTable)
				.set({ claimStatus: "UNCLAIMED" })
				.where(eq(databasesTable.id, params.id));
			throw new Response(
				"Failed to claim database - no connection string on user's project",
				{ status: 500 },
			);
		}
		const callbackUrlOrigin =
			env.DEV_WEBHOOK_ORIGIN || new URL(request.url).origin;
		const pgDumpRestoreCall = await aws.client.fetch(
			`${aws.LAMBDA_FN_API}/${env.PG_DUMP_RESTORE_FUNCTION_NAME}/invocations`,
			{
				headers: { "X-Amz-Invocation-Type": "Event" },
				body: JSON.stringify({
					srcUrl: database.connectionString,
					destUrl,
					callbackUrl: `${callbackUrlOrigin}/databases/${params.id}/claim-callback?dest-url=${encodeURIComponent(destUrl)}&claimed-project=${data.project.id}`,
				}),
			},
		);
		if (pgDumpRestoreCall.status !== 202) {
			console.log(await pgDumpRestoreCall.text());
			await db
				.update(databasesTable)
				.set({ claimStatus: "UNCLAIMED" })
				.where(eq(databasesTable.id, params.id));
			throw new Response(
				"Failed to claim database - failed to call pg_dump_restore function",
				{ status: 500 },
			);
		}
	}
	return redirect(`/databases/${params.id}`);
};

export const action = async ({ request, context }: Route.ActionArgs) => {
	const config = await context.getNeonOAuthConfig();
	const codeVerifier = randomPKCECodeVerifier();
	const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);
	const authUrl = buildAuthorizationUrl(config, {
		redirect_uri: `${new URL(request.url).origin}/oauth/neon`,
		scope: "urn:neoncloud:projects:create urn:neoncloud:orgs:read",
		code_challenge: codeChallenge,
		code_challenge_method: "S256",
		state: JSON.stringify({ redirectTo: request.url }),
	});
	return redirect(authUrl.href, {
		headers: {
			"set-cookie": await createCookie("neon-pkce-code-verifier", {
				path: "/oauth/neon",
				httpOnly: true,
				sameSite: "lax",
				secure: request.url.startsWith("https"),
			}).serialize(codeVerifier),
		},
	});
};

export default () => null;
