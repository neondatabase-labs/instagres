import { sql } from "drizzle-orm";
import {
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

export const claimStatus = pgEnum("claim_status", ["UNCLAIMED", "CLAIMED"]);

export const databasesTable = pgTable("databases", {
	id: uuid().primaryKey(),
	connectionString: text().notNull(),
	neonProjectId: text().notNull(),
	creationDurationMs: integer().notNull(),
	createdAt: timestamp({ withTimezone: true }).notNull().default(sql`now()`),
	claimStatus: claimStatus().notNull().default("UNCLAIMED"),
	claimUrl: text().notNull(),
});
