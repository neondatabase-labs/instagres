import { eq } from "drizzle-orm";
import { z } from "zod";
import { databasesTable } from "~/db/schema";
import type { Route } from "./+types/api.v1.databases.$id";

export const loader = async ({ context: { db }, params }: Route.LoaderArgs) => {
	const { success, data: id } = z.string().uuid().safeParse(params.id);
	if (!success) return new Response("invalid id", { status: 400 });

	const [database] = await db
		.select()
		.from(databasesTable)
		.where(eq(databasesTable.id, id));
	if (!database) return new Response("database not found", { status: 404 });

	return new Response(JSON.stringify(database));
};
