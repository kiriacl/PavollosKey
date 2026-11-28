import "server-only";
import { ApiError, databaseError, jsonError, queryObject, readJson } from "./http";
import { matchRoute } from "./routes";
import { activeProfile, requireUser, withServerClient } from "./session";
import type { Role } from "./session";
import { fields, required, uuid } from "./validation";
import type { Fields } from "./validation";
import type { Input } from "./http";

function validated(input: Input, schema: Fields) {
  try {
    return fields(input, schema);
  } catch {
    throw new ApiError(400, "invalid_input", "Confira os campos e os formatos da operação.");
  }
}

function panel(role: Role) {
  const atalhos = role === "tecnico"
    ? ["servicos", "historico"]
    : ["clientes", "solicitacoes", "orcamentos", "servicos", "historico"];
  return { estabelecimento: process.env.PAVOLLOS_ESTABELECIMENTO?.trim() || "PávollosKeys", atalhos };
}

export async function businessRequest(request: Request, segments: string[]): Promise<Response> {
  const match = matchRoute(request.method, segments);
  if (!match) return jsonError(new ApiError(404, "not_found", "Rota não encontrada."));
  const { route, params } = match;

  let data: Input;
  try {
    const query = queryObject(request);
    const input = route.method === "GET" ? query : await readJson(request);
    if (route.method !== "GET" && Object.keys(query).length) {
      throw new ApiError(400, "invalid_input", "Envie os dados no corpo da requisição.");
    }
    if (route.method === "PATCH" && !Object.keys(input).length) {
      throw new ApiError(400, "invalid_input", "Informe os campos que deseja alterar.");
    }
    const pathFields = Object.fromEntries(Object.keys(params).map((key) => [key, required(uuid)]));
    data = { ...validated(params, pathFields), ...validated(input, route.fields ?? {}) };
  } catch (error) {
    return jsonError(error);
  }

  return withServerClient(async (client, headers) => {
    const user = await requireUser(client);
    const profile = await activeProfile(client, user.id, route.roles);
    if (route.target === "perfil") return Response.json(profile, { headers });
    if (route.target === "painel") return Response.json(panel(profile.papel), { headers });

    if (route.target === "vincular_colaborador") {
      const result = await client.rpc(route.target, {
        p_usuario_id: data.usuario_id,
        p_nome: data.nome,
        p_papel: data.papel,
      });
      if (result.error) throw databaseError(result.error.code);
      return Response.json({ id: result.data }, { status: route.status, headers });
    }

    const result = await client.rpc(route.target, { p_acao: route.action, p_dados: data });
    if (result.error) throw databaseError(result.error.code);
    return Response.json(result.data, { status: route.status ?? 200, headers });
  });
}
