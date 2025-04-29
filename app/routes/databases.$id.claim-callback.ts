import { eq } from "drizzle-orm";
import { redirect } from "react-router";
import { databasesTable } from "~/db/schema";
import type { Route } from "./+types/databases.$id.claim-callback";

export const loader = async ({ params, context: { db } }: Route.LoaderArgs) => {
	const [database] = await db
		.update(databasesTable)
		.set({ claimStatus: "CLAIMED" })
		.where(eq(databasesTable.id, params.id))
		.returning();
	if (!database) throw new Response("Not found", { status: 404 });
	throw redirect(
		`https://console.neon.tech/app/projects/${database.neonProjectId}`,
		{ status: 301 },
	);
};

export default () => null;
