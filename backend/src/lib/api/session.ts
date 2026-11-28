import "server-only";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import type { AuthError, User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "../supabase/server";
import { ApiError, jsonError } from "./http";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
export type Role = "proprietario" | "auxiliar" | "tecnico";
export type Profile = { id: string; nome: string; papel: Role; ativo: true };

const invalidSessionCodes = new Set([
  "bad_jwt", "invalid_jwt", "no_authorization", "session_expired", "session_not_found",
  "refresh_token_not_found", "refresh_token_already_used", "user_not_found", "user_banned",
]);

export async function withServerClient(handler: (client: ServerClient, headers: Headers) => Promise<Response>) {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  try {
    const client = await createSupabaseServerClient(headers);
    return await handler(client, headers);
  } catch (error) {
    return jsonError(error, headers);
  }
}

export async function requireUser(client: ServerClient): Promise<User> {
  const { data: { user }, error } = await client.auth.getUser();
  if (error && !isAuthSessionMissingError(error) && !invalidSessionCodes.has(error.code ?? "")) {
    throw new ApiError(503, "authentication_unavailable", "O serviço de autenticação está indisponível.");
  }
  if (error || !user || typeof user.id !== "string" || !user.id) {
    throw new ApiError(401, "unauthenticated", "Entre para continuar.");
  }
  return user;
}

export async function activeProfile(client: ServerClient, userId: string, roles?: readonly Role[]): Promise<Profile> {
  const { data, error } = await client.from("usuarios").select("id,nome,papel,ativo").eq("id", userId).maybeSingle();
  if (error && error.code !== "42501") {
    throw new ApiError(503, "profiles_unavailable", "O cadastro de colaboradores está indisponível.");
  }
  const allowed = data?.papel === "proprietario" || data?.papel === "auxiliar" || data?.papel === "tecnico";
  if (error || !data || data.ativo !== true || !allowed || (roles && !roles.includes(data.papel))) {
    throw new ApiError(403, "forbidden", "Você não tem um perfil ativo com acesso a esta operação.");
  }
  return { id: userId, nome: data.nome, papel: data.papel, ativo: true };
}

export function authError(error: AuthError) {
  if (error.status === 429) {
    return new ApiError(429, "rate_limited", "Muitas tentativas. Aguarde para tentar novamente.");
  }
  if (!error.status || error.status >= 500) {
    return new ApiError(503, "authentication_unavailable", "O serviço de autenticação está indisponível.");
  }
  return new ApiError(401, "invalid_credentials", "E-mail ou senha inválidos ou conta indisponível.");
}
