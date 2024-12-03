import { redirect } from "react-router";

export const loader = async () => redirect(`/databases/${crypto.randomUUID()}`);
