import { businessRequest } from "../../../lib/api/business";

type Context = { params: Promise<{ operacao: string[] }> };

async function handler(request: Request, context: Context) {
  const { operacao } = await context.params;
  return businessRequest(request, operacao);
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
