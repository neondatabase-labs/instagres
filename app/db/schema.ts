import { sql } from "drizzle-orm";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const databasesTable = pgTable("databases", {
	id: uuid().primaryKey(),
	connectionString: text().notNull(),
	neonProjectId: text().notNull(),
	creationDurationMs: integer().notNull(),
	createdAt: timestamp({ withTimezone: true }).notNull().default(sql`now()`),
});
