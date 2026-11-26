export type Input = Record<string, unknown>;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function jsonError(error: unknown, headers?: Headers) {
  const failure = error instanceof ApiError
    ? error
    : new ApiError(500, "internal_error", "Falha interna.");
  const responseHeaders = headers ?? new Headers();
  responseHeaders.set("Cache-Control", "private, no-store");
  return Response.json({ error: failure.code, message: failure.message }, {
    status: failure.status,
    headers: responseHeaders,
  });
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.PAVOLLOS_APP_ORIGIN || request.url).origin;
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin !== null && origin !== expected)) {
    throw new ApiError(403, "origin_forbidden", "Origem não autorizada.");
  }
}

export function asObject(value: unknown): Input {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "invalid_input", "Envie um objeto JSON.");
  }
  return value as Input;
}

export async function readJson(request: Request): Promise<Input> {
  requireSameOrigin(request);
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new ApiError(415, "unsupported_media_type", "Use Content-Type: application/json.");
  }

  const reader = request.body?.getReader();
  const maxBytes = 65_536;
  let count = 0;
  let text = "";
  const decoder = new TextDecoder();
  if (reader) {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      count += chunk.value.byteLength;
      if (count > maxBytes) {
        await reader.cancel();
        throw new ApiError(413, "payload_too_large", "Corpo da requisição acima do limite.");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
  }
  try {
    return asObject(JSON.parse(text + decoder.decode()));
  } catch {
    throw new ApiError(400, "invalid_input", "Envie um objeto JSON válido.");
  }
}

export function queryObject(request: Request): Input {
  const entries = [...new URL(request.url).searchParams];
  if (new Set(entries.map(([key]) => key)).size !== entries.length) {
    throw new ApiError(400, "invalid_input", "Parâmetro de consulta duplicado.");
  }
  return Object.fromEntries(entries);
}

export function databaseError(code: string | undefined): ApiError {
  switch (code) {
    case "42501":
      return new ApiError(403, "forbidden", "Você não tem permissão para esta operação.");
    case "P0002":
      return new ApiError(404, "not_found", "Registro não encontrado.");
    case "22023":
    case "22P02":
    case "22003":
    case "22007":
    case "22008":
      return new ApiError(400, "invalid_input", "Os dados informados são inválidos.");
    case "55000":
    case "23505":
    case "23503":
    case "23514":
    case "40001":
    case "40P01":
      return new ApiError(409, "conflict", "A operação não é permitida no estado atual.");
    default:
      return new ApiError(503, "database_unavailable", "A operação está indisponível.");
  }
}
