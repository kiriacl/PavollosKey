import type { Role } from "./session";
import {
  choice, dateTime, email, itemFields, items, nullable, optional,
  pagination, required, text, uuid,
} from "./validation";
import type { Fields } from "./validation";

type Method = "GET" | "POST" | "PATCH";
type Target = "mvp_operacoes" | "mvp_orcamentos" | "mvp_ordens" | "vincular_colaborador" | "perfil" | "painel";

type Route = {
  method: Method;
  path: string;
  target: Target;
  action?: string;
  fields?: Fields;
  roles: readonly Role[];
  status?: number;
};

const comercial = ["proprietario", "auxiliar"] as const;
const proprietario = ["proprietario"] as const;
const tecnico = ["tecnico"] as const;
const equipe = ["proprietario", "auxiliar", "tecnico"] as const;
const canal = choice("presencial", "whatsapp");
const contato = { telefone: optional(nullable(text(40))), email: optional(nullable(email)) };
const motivo = { motivo: required(text(1000)) };
const decisao = { canal_aceite: required(canal), evidencia_aceite: required(text(2000)) };

function routesFor(target: Target, entries: Omit<Route, "target">[]): Route[] {
  return entries.map((entry) => ({ target, ...entry }));
}

export const routes: Route[] = [
  { method: "GET", path: "perfil", target: "perfil", roles: equipe },
  { method: "GET", path: "painel/contexto", target: "painel", roles: equipe },
  {
    method: "POST", path: "usuarios/vincular", target: "vincular_colaborador", roles: proprietario, status: 201,
    fields: { usuario_id: required(uuid), nome: required(text(120)), papel: required(choice("auxiliar", "tecnico")) },
  },
  ...routesFor("mvp_operacoes", [
    { method: "GET", path: "usuarios/tecnicos", action: "listar_tecnicos", roles: proprietario, fields: pagination },
    { method: "GET", path: "clientes", action: "listar_clientes", roles: comercial, fields: pagination },
    { method: "POST", path: "clientes", action: "criar_cliente", roles: comercial, status: 201,
      fields: { nome: required(text(120)), ...contato } },
    { method: "GET", path: "clientes/:id", action: "obter_cliente", roles: comercial },
    { method: "PATCH", path: "clientes/:id", action: "atualizar_cliente", roles: comercial,
      fields: { nome: optional(text(120)), ...contato } },
    { method: "GET", path: "atendimentos", action: "listar_atendimentos", roles: comercial,
      fields: { ...pagination, cliente_id: optional(uuid) } },
    { method: "POST", path: "atendimentos", action: "criar_atendimento", roles: comercial, status: 201,
      fields: { cliente_id: required(uuid), canal_entrada: required(canal), descricao: required(text(2000)) } },
    { method: "GET", path: "atendimentos/:id", action: "obter_atendimento", roles: comercial },
    { method: "GET", path: "atendimentos/:id/historico", action: "historico_atendimento", roles: comercial, fields: pagination },
    { method: "POST", path: "atendimentos/:id/encerrar", action: "encerrar_atendimento", roles: comercial,
      fields: { motivo: optional(text(1000)) } },
    { method: "POST", path: "atendimentos/:id/cancelar", action: "cancelar_atendimento", roles: proprietario, fields: motivo },
  ]),
  ...routesFor("mvp_orcamentos", [
    { method: "GET", path: "atendimentos/:atendimento_id/cotacoes", action: "listar_cotacoes", roles: comercial, fields: pagination },
    { method: "POST", path: "atendimentos/:atendimento_id/cotacoes", action: "criar_cotacao", roles: comercial, status: 201,
      fields: { tipo: required(choice("inicial", "complementar")) } },
    { method: "GET", path: "cotacoes/:cotacao_id/orcamentos", action: "listar_orcamentos", roles: comercial, fields: pagination },
    { method: "POST", path: "cotacoes/:cotacao_id/orcamentos", action: "criar_orcamento", roles: comercial, status: 201,
      fields: { validade_ate: optional(nullable(dateTime)), itens: optional(items) } },
    { method: "GET", path: "orcamentos/:id", action: "obter_orcamento", roles: comercial },
    { method: "POST", path: "orcamentos/:id/itens", action: "adicionar_item", roles: comercial, fields: itemFields, status: 201 },
    { method: "POST", path: "orcamentos/:id/enviar", action: "enviar_orcamento", roles: comercial },
    { method: "POST", path: "orcamentos/:id/aprovar", action: "aprovar_orcamento", roles: comercial, fields: decisao },
    { method: "POST", path: "orcamentos/:id/recusar", action: "recusar_orcamento", roles: comercial, fields: decisao },
    { method: "POST", path: "orcamentos/:id/expirar", action: "expirar_orcamento", roles: comercial },
  ]),
  ...routesFor("mvp_ordens", [
    { method: "GET", path: "ordens-servico", action: "listar_ordens", roles: equipe, fields: pagination },
    { method: "POST", path: "ordens-servico", action: "criar_ordem", roles: comercial,
      fields: { item_orcamento_id: required(uuid), local_execucao: optional(nullable(text(500))) } },
    { method: "GET", path: "ordens-servico/:id", action: "obter_ordem", roles: equipe },
    { method: "PATCH", path: "ordens-servico/:id", action: "atualizar_ordem", roles: tecnico,
      fields: { observacao_execucao: required(text(2000)) } },
    { method: "POST", path: "ordens-servico/:id/atribuir", action: "atribuir_ordem", roles: proprietario,
      fields: { tecnico_id: required(uuid) } },
    { method: "POST", path: "ordens-servico/:id/iniciar", action: "iniciar_ordem", roles: tecnico },
    { method: "POST", path: "ordens-servico/:id/concluir", action: "concluir_ordem", roles: tecnico },
    { method: "POST", path: "ordens-servico/:id/cancelar", action: "cancelar_ordem", roles: proprietario, fields: motivo },
    { method: "GET", path: "ordens-servico/:id/historico", action: "historico_ordem", roles: equipe, fields: pagination },
  ]),
];

export function matchRoute(method: string, segments: string[]) {
  for (const route of routes) {
    const parts = route.path.split("/");
    if (method !== route.method || parts.length !== segments.length) continue;
    if (!parts.every((part, i) => part.startsWith(":") || part === segments[i])) continue;
    const params = Object.fromEntries(parts.flatMap((part, i) =>
      part.startsWith(":") ? [[part.slice(1), segments[i]]] : [],
    ));
    return { route, params };
  }
  return null;
}
