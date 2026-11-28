import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { env } from "node:process";
import test from "node:test";
import { URL } from "node:url";

const root = new URL("../../", import.meta.url);
const actor = {
  owner: "189be111-0000-4000-8000-000000000001",
  assistant: "189be111-0000-4000-8000-000000000002",
  technician: "189be111-0000-4000-8000-000000000003",
  otherTechnician: "189be111-0000-4000-8000-000000000004",
  inactive: "189be111-0000-4000-8000-000000000005",
  noProfile: "189be111-0000-4000-8000-000000000006",
};
const rpcNames = {
  operations: "public.mvp_operacoes",
  quotes: "public.mvp_orcamentos",
  orders: "public.mvp_ordens",
};

async function createDatabase() {
  const toolsDir = env.PAVOLLOS_TEST_TOOLS;
  const { PGlite } = toolsDir
    ? createRequire(join(toolsDir, "package.json"))("@electric-sql/pglite")
    : await import("@electric-sql/pglite");
  return new PGlite();
}

async function applyFixtureAndMigrations(db) {
  for (const path of [
    "supabase/tests/fixtures/001_schema_historico.sql",
    "supabase/migrations/002_usuarios_permissoes.sql",
    "supabase/migrations/003_clientes_atendimentos.sql",
    "supabase/migrations/004_cotacoes_orcamentos.sql",
    "supabase/migrations/005_ordens_servico.sql",
  ]) {
    const sql = await readFile(new URL(path, root), "utf8");
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`Não foi possível aplicar ${path} no PostgreSQL em memória.`, { cause: error });
    }
  }
}

async function asUser(db, id, operation, { role = "authenticated", metadata } = {}) {
  await db.exec("BEGIN");
  try {
    await db.exec(role === "anon" ? "SET LOCAL ROLE anon" : "SET LOCAL ROLE authenticated");
    await db.query(
      "SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)",
      [id ?? "", JSON.stringify({ sub: id, role, user_metadata: metadata })],
    );
    const result = await operation();
    await db.exec("COMMIT");
    return result;
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}

function call(db, id, module, action, payload = {}, options) {
  const fn = rpcNames[module];
  return asUser(db, id, async () => {
    const { rows } = await db.query(`SELECT ${fn}($1, $2::jsonb) AS value`, [
      action,
      JSON.stringify(payload),
    ]);
    return rows[0].value;
  }, options);
}

function rejectsWith(operation, code) {
  return assert.rejects(operation, (error) => {
    assert.equal(error.code, code, error.message);
    return true;
  });
}

function linkUser(db, subject, target, profile) {
  return asUser(db, subject, async () => {
    const { rows } = await db.query(
      "SELECT public.vincular_colaborador($1, $2, $3::public.papel_usuario) AS id",
      [target, "Colaborador de teste", profile],
    );
    return rows[0].id;
  });
}

async function seedActors(db) {
  for (const [kind, id] of Object.entries(actor)) {
    await db.query(
      "INSERT INTO auth.users (id, email, invited_at, email_confirmed_at) VALUES ($1, $2, now(), now())",
      [id, `${kind}@example.invalid`],
    );
  }
  await db.query(
    "INSERT INTO public.usuarios (id, nome, papel) VALUES ($1, 'Proprietário de teste', 'proprietario')",
    [actor.owner],
  );
  await rejectsWith(() => linkUser(db, actor.owner, actor.noProfile, "proprietario"), "42501");
  assert.equal(await linkUser(db, actor.owner, actor.assistant, "auxiliar"), actor.assistant);
  for (const id of [actor.technician, actor.otherTechnician, actor.inactive]) {
    assert.equal(await linkUser(db, actor.owner, id, "tecnico"), id);
  }
  await db.query("UPDATE public.usuarios SET ativo = false WHERE id = $1", [actor.inactive]);
}

const item = (escopo, valor) => ({ escopo, valor });
const decision = {
  canal_aceite: "whatsapp",
  evidencia_aceite: "Confirmação explícita de teste",
};

test("MVP no PostgreSQL em memória, usando as migrações reais e o DDL histórico de teste", { timeout: 45000 }, async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  await applyFixtureAndMigrations(db);
  await seedActors(db);

  const ops = (id, action, payload, options) => call(db, id, "operations", action, payload, options);
  const quotes = (id, action, payload) => call(db, id, "quotes", action, payload);
  const orders = (id, action, payload) => call(db, id, "orders", action, payload);
  let cliente;
  let atendimento;
  let cotacao;
  let aprovado;
  let ordem;

  await t.test("perfil próprio, papel do banco, inatividade e bloqueio de escrita direta", async () => {
    const { rows } = await asUser(db, actor.assistant, () =>
      db.query("SELECT id, papel, ativo FROM public.usuarios"),
    );
    assert.deepEqual(rows, [{ id: actor.assistant, papel: "auxiliar", ativo: true }]);
    await rejectsWith(() => ops(null, "listar_clientes", {}, { role: "anon" }), "42501");
    for (const denied of [actor.technician, actor.inactive, actor.noProfile]) {
      await rejectsWith(() => ops(denied, "listar_clientes", {}, {
        metadata: { papel: "proprietario" },
      }), "42501");
    }
    await rejectsWith(() => orders(actor.inactive, "listar_ordens", {}), "42501");
    await rejectsWith(() => linkUser(db, actor.assistant, actor.noProfile, "tecnico"), "42501");
    await rejectsWith(() => linkUser(db, actor.owner, actor.inactive, "auxiliar"), "23505");
    await rejectsWith(() => asUser(db, actor.owner, () =>
      db.query("UPDATE public.usuarios SET ativo = true WHERE id = $1", [actor.inactive]),
    ), "42501");
    await rejectsWith(() => asUser(db, actor.owner, () =>
      db.query("SELECT id FROM public.clientes"),
    ), "42501");
  });

  await t.test("criação e consulta de cliente e atendimento", async () => {
    await rejectsWith(() => ops(actor.assistant, "criar_cliente", { nome: "" }), "22023");
    cliente = await ops(actor.assistant, "criar_cliente", { nome: "Cliente sintético" });
    assert.ok(cliente.id);
    const atualizado = await ops(actor.assistant, "atualizar_cliente", {
      id: cliente.id,
      nome: "Cliente sintético atualizado",
    });
    assert.equal(atualizado.nome, "Cliente sintético atualizado");
    assert.equal((await ops(actor.owner, "obter_cliente", { id: cliente.id })).id, cliente.id);
    assert.ok((await ops(actor.owner, "listar_clientes")).some((row) => row.id === cliente.id));
    await rejectsWith(() => ops(actor.assistant, "criar_atendimento", {
      cliente_id: cliente.id, descricao: "Descrição de teste", canal_entrada: "outro",
    }), "22023");
    atendimento = await ops(actor.assistant, "criar_atendimento", {
      cliente_id: cliente.id, descricao: "Atendimento sintético", canal_entrada: "whatsapp",
    });
    assert.equal(atendimento.status, "aberto");
    assert.equal(atendimento.canal_entrada, "whatsapp");
    assert.equal((await ops(actor.owner, "obter_atendimento", { id: atendimento.id })).id, atendimento.id);
    assert.ok((await ops(actor.owner, "listar_atendimentos")).some((row) => row.id === atendimento.id));
  });

  await t.test("versionamento, envio sem aceite, recusa e aprovação documentada", async () => {
    cotacao = await quotes(actor.assistant, "criar_cotacao", { atendimento_id: atendimento.id, tipo: "inicial" });
    await rejectsWith(() => quotes(actor.assistant, "criar_cotacao", {
      atendimento_id: atendimento.id, tipo: "inicial",
    }), "55000");
    await rejectsWith(() => quotes(actor.assistant, "criar_orcamento", {
      cotacao_id: cotacao.id, itens: [item("Precisão inválida", 12.345)],
    }), "22023");

    const primeiro = await quotes(actor.assistant, "criar_orcamento", {
      cotacao_id: cotacao.id, itens: [item("Primeiro item", 120.30), item("Segundo item", 10.25)],
    });
    assert.equal(primeiro.versao, 1);
    assert.equal(primeiro.total, 130.55);
    await rejectsWith(() => orders(actor.assistant, "criar_ordem", {
      item_orcamento_id: primeiro.itens[0].id,
    }), "55000");
    await rejectsWith(() => quotes(actor.assistant, "aprovar_orcamento", { id: primeiro.id, ...decision }), "55000");

    const enviado = await quotes(actor.assistant, "enviar_orcamento", { id: primeiro.id });
    assert.equal(enviado.status, "enviado");
    assert.equal(enviado.aprovado_em, null);
    await rejectsWith(() => orders(actor.assistant, "criar_ordem", {
      item_orcamento_id: primeiro.itens[0].id,
    }), "55000");
    await rejectsWith(() => quotes(actor.assistant, "adicionar_item", {
      id: primeiro.id, ...item("Inclusão indevida", 1),
    }), "55000");
    await rejectsWith(() => quotes(actor.assistant, "aprovar_orcamento", {
      id: primeiro.id, canal_aceite: "whatsapp", evidencia_aceite: "",
    }), "22023");

    const segunda = await quotes(actor.assistant, "criar_orcamento", {
      cotacao_id: cotacao.id, itens: [item("Nova versão", 90)],
    });
    assert.equal(segunda.versao, 2);
    await quotes(actor.assistant, "enviar_orcamento", { id: segunda.id });
    assert.equal((await quotes(actor.owner, "obter_orcamento", { id: primeiro.id })).status, "substituido");
    await rejectsWith(() => quotes(actor.assistant, "aprovar_orcamento", { id: primeiro.id, ...decision }), "55000");
    const recusado = await quotes(actor.assistant, "recusar_orcamento", {
      id: segunda.id, canal_aceite: "presencial", evidencia_aceite: "Recusa explícita de teste",
    });
    assert.equal(recusado.status, "recusado");
    await rejectsWith(() => orders(actor.assistant, "criar_ordem", {
      item_orcamento_id: recusado.itens[0].id,
    }), "55000");

    const terceira = await quotes(actor.assistant, "criar_orcamento", {
      cotacao_id: cotacao.id, itens: [item("Serviço de teste", 80), item("Serviço cancelável", 40)],
    });
    const extra = await quotes(actor.assistant, "adicionar_item", { id: terceira.id, ...item("Item não emitido", 7.50) });
    assert.equal(extra.posicao, 3);
    await quotes(actor.assistant, "enviar_orcamento", { id: terceira.id });
    aprovado = await quotes(actor.assistant, "aprovar_orcamento", { id: terceira.id, ...decision });
    assert.equal(aprovado.status, "aprovado");
    assert.equal(aprovado.total, 127.50);
    assert.equal(aprovado.evidencia_aceite, decision.evidencia_aceite);
    assert.equal(aprovado.aceite_registrado_por, actor.assistant);
    await rejectsWith(() => quotes(actor.assistant, "criar_orcamento", { cotacao_id: cotacao.id }), "55000");
    const complementar = await quotes(actor.assistant, "criar_cotacao", {
      atendimento_id: atendimento.id, tipo: "complementar",
    });
    assert.equal(complementar.tipo, "complementar");
    assert.equal((await quotes(actor.owner, "listar_orcamentos", { cotacao_id: cotacao.id })).length, 3);
    assert.equal((await quotes(actor.owner, "listar_cotacoes", { atendimento_id: atendimento.id })).length, 2);
  });

  await t.test("ordem idempotente, atribuição e execução somente pelo técnico responsável", async () => {
    ordem = await orders(actor.assistant, "criar_ordem", {
      item_orcamento_id: aprovado.itens[0].id, local_execucao: "Bancada de teste",
    });
    assert.equal(ordem.status, "aguardando_atribuicao");
    assert.equal((await orders(actor.assistant, "criar_ordem", {
      item_orcamento_id: aprovado.itens[0].id,
    })).id, ordem.id);
    await rejectsWith(() => orders(actor.assistant, "atribuir_ordem", {
      id: ordem.id, tecnico_id: actor.technician,
    }), "42501");
    await rejectsWith(() => orders(actor.owner, "atribuir_ordem", {
      id: ordem.id, tecnico_id: actor.inactive,
    }), "22023");
    assert.equal((await orders(actor.owner, "atribuir_ordem", {
      id: ordem.id, tecnico_id: actor.technician,
    })).status, "atribuida");
    assert.ok((await orders(actor.technician, "listar_ordens")).some((row) => row.id === ordem.id));
    assert.ok(!(await orders(actor.otherTechnician, "listar_ordens")).some((row) => row.id === ordem.id));
    await rejectsWith(() => orders(actor.otherTechnician, "obter_ordem", { id: ordem.id }), "P0002");
    await rejectsWith(() => orders(actor.otherTechnician, "iniciar_ordem", { id: ordem.id }), "42501");
    await rejectsWith(() => orders(actor.otherTechnician, "atualizar_ordem", {
      id: ordem.id, observacao_execucao: "Tentativa de alteração",
    }), "42501");
    await rejectsWith(() => ops(actor.owner, "encerrar_atendimento", {
      id: atendimento.id, motivo: "Encerramento prematuro",
    }), "55000");
    assert.equal((await orders(actor.technician, "iniciar_ordem", { id: ordem.id })).status, "em_execucao");
    assert.equal((await orders(actor.technician, "atualizar_ordem", {
      id: ordem.id, observacao_execucao: "Execução de teste",
    })).observacao_execucao, "Execução de teste");
    assert.equal((await orders(actor.technician, "concluir_ordem", { id: ordem.id })).status, "concluida");
    await rejectsWith(() => orders(actor.technician, "iniciar_ordem", { id: ordem.id }), "55000");
    const historico = await orders(actor.technician, "historico_ordem", { id: ordem.id });
    assert.ok(historico.some((row) => row.status_novo === "concluida"));
    assert.ok(historico.some((row) => row.tipo_evento === "atribuicao"));
    assert.equal(historico.filter((row) => row.status_novo === "aguardando_atribuicao").length, 1);
    await rejectsWith(() => orders(actor.otherTechnician, "historico_ordem", { id: ordem.id }), "P0002");
  });

  await t.test("cancelamento auditado e encerramento explícito do atendimento", async () => {
    const outra = await orders(actor.owner, "criar_ordem", { item_orcamento_id: aprovado.itens[1].id });
    const motivo = "Cancelamento de teste confirmado";
    assert.equal((await orders(actor.owner, "cancelar_ordem", { id: outra.id, motivo })).status, "cancelada");
    const cancelada = await orders(actor.owner, "obter_ordem", { id: outra.id });
    assert.equal(cancelada.motivo_cancelamento, motivo);
    assert.equal(cancelada.cancelado_por, actor.owner);
    assert.ok(cancelada.cancelado_em);
    assert.equal((await orders(actor.owner, "criar_ordem", {
      item_orcamento_id: aprovado.itens[1].id,
    })).id, outra.id);
    await rejectsWith(() => ops(actor.owner, "encerrar_atendimento", { id: atendimento.id }), "22023");
    const encerrado = await ops(actor.owner, "encerrar_atendimento", {
      id: atendimento.id, motivo: "Aprovado, mas cliente dispensou o último item.",
    });
    assert.equal(encerrado.status, "encerrado");
    const historico = await ops(actor.owner, "historico_atendimento", { id: atendimento.id });
    assert.ok(historico.some((row) => row.status_novo === "encerrado"));
    assert.ok(historico.some((row) => row.status_novo === "aprovado"));
    assert.ok(historico.some((row) => row.status_novo === "cancelada" && row.motivo === motivo));
    assert.ok(historico.some((row) => row.status_novo === "recusado" && row.motivo.includes("Recusa explícita")));
    await rejectsWith(() => orders(actor.owner, "criar_ordem", {
      item_orcamento_id: aprovado.itens[2].id,
    }), "55000");
  });

  await t.test("validade expirada impede aceite e ordem", async () => {
    const outro = await ops(actor.assistant, "criar_atendimento", {
      cliente_id: cliente.id, descricao: "Validade de teste", canal_entrada: "presencial",
    });
    const opcao = await quotes(actor.owner, "criar_cotacao", { atendimento_id: outro.id, tipo: "inicial" });
    const versao = await quotes(actor.owner, "criar_orcamento", {
      cotacao_id: opcao.id, itens: [item("Item de teste", 10)],
    });
    await quotes(actor.owner, "enviar_orcamento", { id: versao.id });
    await rejectsWith(() => quotes(actor.owner, "expirar_orcamento", { id: versao.id }), "55000");

    // Somente a preparação do teste controla as datas, sem depender do relógio do sistema.
    await db.query(
      "UPDATE public.orcamentos SET enviado_em = now() - interval '2 hours', validade_ate = now() - interval '1 hour' WHERE id = $1",
      [versao.id],
    );
    await rejectsWith(() => quotes(actor.owner, "aprovar_orcamento", { id: versao.id, ...decision }), "55000");
    assert.equal((await quotes(actor.owner, "expirar_orcamento", { id: versao.id })).status, "expirado");
    await rejectsWith(() => orders(actor.owner, "criar_ordem", {
      item_orcamento_id: versao.itens[0].id,
    }), "55000");
    assert.equal((await ops(actor.owner, "cancelar_atendimento", {
      id: outro.id, motivo: "Orçamento expirado",
    })).status, "cancelado");
  });
});
