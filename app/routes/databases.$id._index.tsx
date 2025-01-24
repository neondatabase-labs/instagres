import { useInterval } from "@chakra-ui/react-use-interval";
import {
	Turnstile,
	type TurnstileServerValidationResponse,
} from "@marsidev/react-turnstile";
import { eq } from "drizzle-orm";
import { CheckCircle2Icon, DatabaseZap, TriangleAlert } from "lucide-react";
import { redirect, useNavigate } from "react-router";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import CopyButton from "~/components/ui/copyButton";
import { databasesTable } from "~/db/schema";
import { findClosestRegion } from "~/lib/utils";
import type { Route } from "./+types/databases.$id._index";

export const loader = async ({
	context: { db, TURNSTILE_SITE_KEY },
	params,
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

	if (!database) {
		const before = Date.now();
		const { data, error } = await neon.POST("/projects", {
			body: {
				project: {
					pg_version: 16,
					name: `instagres-${id}`,
					region_id: findClosestRegion(request.headers),
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

	return redirect(request.url, { status: 303 });
};

const DbByIdPage = ({
	loaderData: { database, turnstileSiteKey },
}: Route.ComponentProps) => {
	const navigate = useNavigate();
	useInterval(() => {
		if (database?.claimStatus === "CLAIMING") navigate(0);
	}, 2000);

	if (database) {
		if (database.claimStatus === "CLAIMING")
			return (
				<div className="flex flex-col justify-center items-center min-h-screen p-4  text-center">
					<Card className="max-w-full">
						<CardHeader>
							<DatabaseZap className=" text-yellow-500 text-2xl m-auto mb-2 w-8 h-8" />
							<CardTitle className="font-bold tracking-tight text-2xl">
								We're transfering your database
							</CardTitle>
							<CardDescription>
								<div>
									Hang tight, we'll tell you here once it's ready.
									<br />
									<br />
									<div className="flex items-center text-start text-xs text-card-foreground">
										<TriangleAlert className="mr-4 size-6 text-yellow-500 inline" />
										<br />
										<br />
										Note that the connection string will change (we hope to fix
										this soon). <br /> Prepare to edit this in your app if
										you've already used it.
									</div>
								</div>
							</CardDescription>
						</CardHeader>
					</Card>
				</div>
			);

		if (database.claimStatus === "CLAIMED")
			return (
				<div className="flex flex-col justify-center items-center min-h-screen p-4  text-center">
					<Card className="max-w-full">
						<CardHeader>
							<div className="text-3xl">🚀</div>
							<CardTitle className="font-bold tracking-tight text-2xl">
								Your database has been transferred!
							</CardTitle>
							<CardDescription>
								<div>
									Self destruct cancelled! 😊<br />
									Now it's{" "}
									<a
										href={`https://console.neon.tech/app/projects/${database.claimedProject}`}
										className="underline text-teal-500 font-bold"
									>
										here
									</a>{" "}
									in your Neon account.
									<div className="my-3">—</div>
									<div className="flex items-center justify-center">
										<TriangleAlert className="mr-3 size-6 text-teal-500" /> Your
										connection string has changed! You should update it in your
										app. This is the new one ⬇️
									</div>
								</div>
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="flex items-center">
								<p className="text-sm font-medium leading-none mx-3 flex-none mb-1">
									Connection string:
								</p>
								<div className="rounded-sm overflow-clip relative min-w-0">
									<CopyButton textToCopy={database.connectionString.trim()} />
									<pre className="max-w-lg overflow-x-scroll text-foreground bg-muted text-xs">
										<div className="px-4 py-3 w-fit">
											{database.connectionString.trim()}
										</div>
									</pre>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			);

		return (
			<div className="flex flex-col justify-center items-center min-h-screen p-4  text-center">
				<Card className="max-w-full">
					<CardHeader>
						<CheckCircle2Icon className=" text-green-600 text-2xl m-auto mb-2 w-8 h-8" />
						<CardTitle className="font-bold tracking-tight text-2xl">
							Your database is ready
						</CardTitle>
						<CardDescription>
							<div>
								It was created in {database.creationDurationMs}ms 🚀
								<div className="my-3">—</div>
								<div className="flex items-center justify-center">
									<TriangleAlert className="mr-3 size-6 text-teal-500" />
									Database will self-destruct in 1 hour. To keep it:
								</div>
							</div>
							<form
								className="my-4"
								method="POST"
								action={`/databases/${database.id}/claim`}
							>
								<Button
									className="text-teal-500"
									variant={"secondary"}
									type="submit"
								>
									Transfer it to your Neon account
								</Button>
							</form>
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center">
							<p className="text-sm font-medium leading-none mx-3 flex-none mb-1">
								Connection string:
							</p>
							<div className="rounded-sm overflow-clip relative min-w-0">
								<CopyButton textToCopy={database.connectionString} />
								<pre className="max-w-lg overflow-x-scroll text-foreground bg-muted text-xs">
									<div className="px-4 py-3 w-fit">
										{database.connectionString}
									</div>
								</pre>
							</div>
						</div>
						{database.claimError && (
							<div className="flex items-center flex-col mt-6">
								<p className="text-sm mx-3 flex-none mb-3 text-start text-red-600">
									Oops, there was an error transfering your database:
									<br />
									<span className="font-bold">- Try the transfer again ⬆️</span>
									<br />- Or tell us in the feedback form in your Neon Account
								</p>
								<div className="rounded-sm overflow-clip relative min-w-0">
									<CopyButton textToCopy={database.connectionString} />
									<pre className="max-w-lg overflow-x-scroll text-foreground bg-muted text-xs">
										<div className="px-4 py-3 w-fit">{database.claimError}</div>
									</pre>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
				<div className="text-sm text-muted-foreground mt-6">
					If this page opened from your terminal, you may return to it now.
					<br />
					But keep this window open to claim the database with your Neon account
					⬆️
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col justify-center items-center min-h-screen p-4 text-center">
			<h1 className="text-2xl font-bold tracking-tight my-6">
				Checking that you're not a big bad bot...
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
};

export default DbByIdPage;
