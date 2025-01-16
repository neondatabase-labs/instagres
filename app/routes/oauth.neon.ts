import { authorizationCodeGrant } from "openid-client";
import { createCookie, redirect } from "react-router";
import type { Route } from "./+types/oauth.neon";

export const loader = async ({ request, context }: Route.LoaderArgs) => {
	const url = new URL(request.url);
	const state = url.searchParams.get("state") ?? "";
	const pkceCodeVerifier = await createCookie("neon-pkce-code-verifier").parse(
		request.headers.get("cookie") ?? "",
	);
	const tokens = await authorizationCodeGrant(
		await context.getNeonOAuthConfig(),
		url,
		{ pkceCodeVerifier, expectedState: state },
	);
	let redirectTo: string;
	try {
		redirectTo = JSON.parse(decodeURIComponent(state)).redirectTo;
	} catch (e) {
		throw new Response("Invalid state parameter", { status: 400 });
	}
	const redirectToUrl = new URL(redirectTo);
	redirectToUrl.searchParams.set("access-token", tokens.access_token);
	return redirect(redirectToUrl.href);
};

export default () => null;
