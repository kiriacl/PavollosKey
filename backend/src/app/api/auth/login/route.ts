import { ApiError, readJson } from "../../../../lib/api/http";
import { activeProfile, authError, withServerClient } from "../../../../lib/api/session";
import { email, fields, password, required } from "../../../../lib/api/validation";

export function POST(request: Request) {
  return withServerClient(async (client, headers) => {
    const input = await readJson(request);
    let credentials;
    try {
      credentials = fields(input, { email: required(email), password: required(password) });
    } catch {
      throw new ApiError(400, "invalid_input", "Informe e-mail e senha válidos.");
    }
    const { data, error } = await client.auth.signInWithPassword({
      email: credentials.email as string,
      password: credentials.password as string,
    });
    if (error) throw authError(error);
    if (!data.user) throw new ApiError(401, "unauthenticated", "Não foi possível iniciar a sessão.");

    try {
      const perfil = await activeProfile(client, data.user.id);
      return Response.json({ perfil }, { headers });
    } catch (profileError) {
      await client.auth.signOut({ scope: "local" }).catch(() => undefined);
      throw profileError;
    }
  });
}
