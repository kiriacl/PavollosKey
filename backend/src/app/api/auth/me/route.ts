import { requireUser, withServerClient } from "../../../../lib/api/session";

export function GET() {
  return withServerClient(async (client, headers) => {
    const user = await requireUser(client);
    return Response.json({
      user: { id: user.id, email: typeof user.email === "string" ? user.email : null },
    }, { headers });
  });
}
