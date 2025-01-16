import { eq } from "drizzle-orm";
import { z } from "zod";
import { databasesTable } from "~/db/schema";
import type { Route } from "./+types/databases.$id.claim";

export const loader = async () => {
	throw new Response("Not found", { status: 404 });
};

export const action = async ({
	request,
	context,
	params,
}: Route.ActionArgs) => {
	let jsonBody: unknown;
	try {
		jsonBody = await request.json();
	} catch (e) {
		console.log(e);
		throw new Response("Invalid JSON", { status: 400 });
	}
	const { data, error } = z
		.object({ output: z.string(), failed: z.boolean() })
		.safeParse(jsonBody);
	if (error) {
		console.log(error);
		throw new Response("Invalid body", { status: 400 });
	}
	const searchParams = new URL(request.url).searchParams;
	if (data.failed) {
		console.log(
			`Failed to claim database: ${params.id} - saving the output in claimError`,
		);
		await context.db
			.update(databasesTable)
			.set({ claimStatus: "UNCLAIMED", claimError: data.output })
			.where(eq(databasesTable.id, params.id));
	} else {
		const claimedProject = searchParams.get("claimed-project");
		if (!claimedProject) {
			console.log(
				"claimed-project URL search parameter is required in:",
				request.url,
			);
			throw new Response("claimed-project URL search parameter is required", {
				status: 400,
			});
		}
		const destUrl = searchParams.get("dest-url");
		if (!destUrl) {
			console.log("dest-url URL search parameter is required in:", request.url);
			throw new Response("dest-url URL search parameter is required", {
				status: 400,
			});
		}
		await context.db
			.update(databasesTable)
			.set({
				claimStatus: "CLAIMED",
				claimedProject,
				connectionString: destUrl,
			})
			.where(eq(databasesTable.id, params.id));
	}
};

export default () => null;
