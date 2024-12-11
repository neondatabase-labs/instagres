import {
	Turnstile,
	type TurnstileServerValidationResponse,
} from "@marsidev/react-turnstile";
import { eq } from "drizzle-orm";
import { CheckCircle2Icon } from "lucide-react";
import { redirect } from "react-router";
import { z } from "zod";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { databasesTable } from "~/db/schema";
import { findClosestRegion } from "~/lib/utils";
import type { Route } from "./+types/databases.$id";

export const loader = async ({
	context: { db, TURNSTILE_SITE_KEY },
	params,
	request,
}: Route.LoaderArgs) => {
	const { success, data: id } = z.string().uuid().safeParse(params.id);
	if (!success) throw new Response("Invalid Id", { status: 400 });
	const [database] = await db
		.select()
		.from(databasesTable)
		.where(eq(databasesTable.id, id));

	return {
		database,
		turnstileSiteKey: TURNSTILE_SITE_KEY,
		fromCli: new URL(request.url).searchParams.has("from-cli"),
	};
};

export const action = async ({
	request,
	context: { TURNSTILE_SECRET_KEY, db, neon },
	params,
}: Route.ActionArgs) => {
	if (request.method !== "POST")
		throw new Response("Method Not Allowed", { status: 405 });
	const { success: validUuid, data: id } = z
		.string()
		.uuid()
		.safeParse(params.id);
	if (!validUuid) throw new Response("Invalid Id", { status: 400 });
	const token = (await request.formData()).get("token")?.toString();
	if (!token) throw new Response("Token Required", { status: 400 });

	const res = await fetch(
		"https://challenges.cloudflare.com/turnstile/v0/siteverify",
		{
			method: "POST",
			body: `secret=${encodeURIComponent(TURNSTILE_SECRET_KEY)}&response=${encodeURIComponent(token)}`,
			headers: { "content-type": "application/x-www-form-urlencoded" },
		},
	);
	const { success } = (await res.json()) as TurnstileServerValidationResponse;
	if (!success) throw new Response("Invalid Token", { status: 400 });

	const [database] = await db
		.select()
		.from(databasesTable)
		.where(eq(databasesTable.id, id));

	// Default to Paris
	const ipLongitude = Number(request.headers.get("cf-iplongitude")) || 2.4075;
	const ipLatitude = Number(request.headers.get("cf-iplatitude")) || 48.8323;

	if (!database) {
		const before = Date.now();
		const { data, error } = await neon.POST("/projects", {
			body: {
				project: {
					name: `instagres-${id}`,
					region_id: findClosestRegion({ lat: ipLatitude, lon: ipLongitude }),
					settings: {
						quota: {
							data_transfer_bytes: 1000 * 1024 * 1024,
							logical_size_bytes: 100 * 1024 * 1024,
						},
					},
				},
			},
		});
		const after = Date.now();
		if (error) throw new Response("Failed to create project", { status: 500 });
		const { project, connection_uris } = data;
		if (!connection_uris[0])
			throw new Response("No connection URI", { status: 500 });
		await db.insert(databasesTable).values({
			id,
			neonProjectId: project.id,
			connectionString: connection_uris[0]?.connection_uri,
			creationDurationMs: after - before,
		});
	}

	return redirect(request.url);
};

const DbByIdPage = ({
	loaderData: { database, turnstileSiteKey, fromCli },
}: Route.ComponentProps) =>
	database ? (
		<div className="flex flex-col justify-center items-center min-h-screen p-4  text-center">
			<Card className="max-w-full">
				<CardHeader>
					<CheckCircle2Icon className=" text-green-600 text-2xl m-auto mb-2 w-8 h-8" />
					<CardTitle className="font-bold tracking-tight text-2xl">
						Your database is ready
					</CardTitle>
					<CardDescription>
						It was created in {database.creationDurationMs}ms 🚀
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center">
						<p className="text-sm font-medium leading-none mr-2 flex-none">
							Connection string:
						</p>
						<pre className="max-w-lg overflow-x-auto text-foreground  rounded-sm bg-muted flex-1 text-xs">
							<div className="px-3 py-2 w-fit">{database.connectionString}</div>
						</pre>
					</div>
				</CardContent>
			</Card>
			{fromCli && (
				<div className="text-sm text-muted-foreground mt-6">
					You may close this window and return to your terminal.
				</div>
			)}
		</div>
	) : (
		<div className="flex flex-col justify-center items-center min-h-screen p-4 text-center">
			<h1 className="text-2xl font-bold tracking-tight my-6">
				Just checking you're not a big bad bot...
			</h1>
			<div className="w-fit m-auto my-6 h-0">
				<Turnstile
					siteKey={turnstileSiteKey}
					onSuccess={(token) => {
						const form = document.createElement("form");
						form.method = "POST";
						const input = document.createElement("input");
						input.type = "hidden";
						input.name = "token";
						input.value = token;
						form.appendChild(input);
						document.body.appendChild(form);
						form.submit();
					}}
				/>
			</div>
		</div>
	);

export default DbByIdPage;
