import { defineConfig } from "drizzle-kit";
import assert from "node:assert";

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			DATABASE_URL?: string;
		}
	}
}

assert(process.env.DATABASE_URL, "DATABASE_URL is not set");

export default defineConfig({
	out: "./drizzle",
	schema: "./app/db/schema.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL,
	},
});
