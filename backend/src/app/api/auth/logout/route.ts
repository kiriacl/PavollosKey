import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { ApiError, readJson } from "../../../../lib/api/http";
import { authError, withServerClient } from "../../../../lib/api/session";

export function POST(request: Request) {
  return withServerClient(async (client, headers) => {
    const input = await readJson(request);
    if (Object.keys(input).length) throw new ApiError(400, "invalid_input", "Envie um objeto JSON vazio.");

    const { error } = await client.auth.signOut({ scope: "local" });
    if (error && !isAuthSessionMissingError(error)) throw authError(error);
    return new Response(null, { status: 204, headers });
  });
}
