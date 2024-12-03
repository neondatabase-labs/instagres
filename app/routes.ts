import {
	type RouteConfig,
	index,
	prefix,
	route,
} from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

export default flatRoutes() satisfies RouteConfig;

[
	index("routes/home.tsx"),
	...prefix("databases", [
		index("routes/database.tsx"),
		...prefix(":id", [
			index("routes/database.tsx"),
			route("new", "routes/new.tsx"),
			route("claim", "routes/claim.tsx"),
		]),
	]),
	...prefix(
		"api",
		prefix(
			"v1",
			prefix(
				"databases",
				prefix(":id", [
					index("routes/database.tsx"),
					route("claim", "routes/claim.tsx"),
					route("validate", "routes/validate.tsx"),
				]),
			),
		),
	),
] satisfies RouteConfig;
