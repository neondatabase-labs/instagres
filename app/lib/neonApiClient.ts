import createClient from "openapi-fetch";
import type { paths } from "./neonSchema.gen";

export default (apiKey: string) => {
	return createClient<paths>({
		baseUrl: "https://console.neon.tech/api/v2/",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
	});
};
