import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { URL } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const host = "127.0.0.1";
const root = new URL("../../", import.meta.url);
const id = (suffix) => "8e3d0000-0000-4000-8000-00000000000" + suffix;
const user = {
  proprietario: { id: id(1), email: "owner@example.invalid", nome: "Proprietário sintético", papel: "proprietario", ativo: true },
  tecnico: { id: id(2), email: "tech@example.invalid", nome: "Técnico sintético", papel: "tecnico", ativo: true },
  inativo: { id: id(3), email: "inactive@example.invalid", nome: "Perfil sintético", papel: "tecnico", ativo: false },
  outroTecnico: { id: id(4), email: "other-tech@example.invalid", nome: "Outro técnico sintético", papel: "tecnico", ativo: true },
  auxiliar: { id: id(5), email: "aux@example.invalid", nome: "Auxiliar sintético" },
};
const expiresAt = Math.floor(Date.now() / 1000) + 3600;
const encode = (object) => Buffer.from(JSON.stringify(object)).toString("base64url");
const sessions = Object.values(user).map((row) => ({
  identity: { id: row.id, email: row.email, aud: "authenticated", app_metadata: {}, user_metadata: {} },
  token: [encode({ alg: "HS256", typ: "JWT" }), encode({ sub: row.id, exp: expiresAt }), "c2ln"].join("."),
}));

const rpcQueries = new Map([
  ["mvp_operacoes", "SELECT public.mvp_operacoes($1, $2::jsonb) AS value"],
  ["mvp_orcamentos", "SELECT public.mvp_orcamentos($1, $2::jsonb) AS value"],
  ["mvp_ordens", "SELECT public.mvp_ordens($1, $2::jsonb) AS value"],
  ["vincular_colaborador", "SELECT public.vincular_colaborador($1, $2, $3::public.papel_usuario) AS value"],
]);

async function prepareDatabase(db) {
  for (const path of [
    "supabase/tests/fixtures/001_schema_historico.sql",
    "supabase/migrations/002_usuarios_permissoes.sql",
    "supabase/migrations/003_clientes_atendimentos.sql",
    "supabase/migrations/004_cotacoes_orcamentos.sql",
    "supabase/migrations/005_ordens_servico.sql",
  ]) {
    await db.exec(await readFile(new URL(path, root), "utf8"));
  }
  for (const { id, email, nome, papel, ativo } of Object.values(user)) {
    await db.query(
      "INSERT INTO auth.users (id, email, invited_at, email_confirmed_at) VALUES ($1, $2, now(), now())",
      [id, email],
    );
    if (papel) {
      await db.query("INSERT INTO public.usuarios (id, nome, papel, ativo) VALUES ($1, $2, $3, $4)", [id, nome, papel, ativo]);
    }
  }
}

function asSession(db, session, query, params) {
  return db.transaction(async (tx) => {
    await tx.exec("SET LOCAL ROLE authenticated");
    const sub = session.identity.id;
    await tx.query(
      "SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)",
      [sub, JSON.stringify({ sub, role: "authenticated" })],
    );
    return tx.query(query, params);
  });
}

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function input(request) {
  let body = "";
  for await (const chunk of request) body += chunk;
  return JSON.parse(body);
}

// Simula Auth e o transporte HTTP da Data API. Perfis, regras, RLS e auditoria são do PostgreSQL.
function createUpstream(db) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://" + host);
      const path = url.pathname;

      if (path === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
        const body = await input(request);
        const session = sessions.find((fixture) => fixture.identity.email === body.email && body.password === "in-memory-test");
        if (!session) return json(response, 400, { error_code: "invalid_credentials", message: "Synthetic refusal" });
        return json(response, 200, {
          user: session.identity, access_token: session.token,
          refresh_token: "fixture-refresh", token_type: "bearer", expires_in: 3600,
        });
      }

      const session = sessions.find((fixture) => request.headers.authorization === "Bearer " + fixture.token);
      if (!session) return json(response, 401, { error_code: "bad_jwt", message: "Synthetic missing session" });
      if (path === "/auth/v1/user") return json(response, 200, session.identity);
      if (path === "/auth/v1/logout") {
        response.writeHead(204);
        response.end();
        return;
      }

      const userFilter = url.searchParams.get("id");
      if (request.method === "GET" && path === "/rest/v1/usuarios" && userFilter?.startsWith("eq.")) {
        const { rows } = await asSession(db, session,
          "SELECT id, nome, papel, ativo FROM public.usuarios WHERE id = $1", [userFilter.slice(3)]);
        return json(response, 200, rows);
      }

      if (request.method === "POST" && path.startsWith("/rest/v1/rpc/")) {
        const name = path.slice("/rest/v1/rpc/".length);
        const query = rpcQueries.get(name);
        if (query) {
          const body = await input(request);
          const params = name === "vincular_colaborador"
            ? [body.p_usuario_id, body.p_nome, body.p_papel]
            : [body.p_acao, JSON.stringify(body.p_dados)];
          const { rows } = await asSession(db, session, query, params);
          return json(response, 200, rows[0].value);
        }
      }
      return json(response, 404, { message: "Bridge not configured for this test request" });
    } catch (error) {
      const code = error?.code;
      if (typeof code === "string" && /^[A-Z0-9]{5}$/.test(code)) {
        const status = code === "42501" ? 403 : code === "P0002" ? 404 : 400;
        return json(response, status, { code, message: "Internal database fixture detail" });
      }
      return json(response, 500, { message: "Invalid test request" });
    }
  });
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => resolve(server.address().port));
  });
}

async function close(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
}

async function expectedJson(response, status) {
  assert.equal(response.status, status);
  return response.json();
}

test("fluxo HTTP Next.js com Auth/Data API em loopback e migrações reais no PostgreSQL em memória", { timeout: 70_000 }, async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await prepareDatabase(db);
  const upstream = createUpstream(db);
  const upstreamPort = await listen(upstream);
  let app;
  let stopped;
  try {
    const probe = createServer();
    const port = await listen(probe);
    await close(probe);
    const base = "http://" + host + ":" + port;
    app = spawn(process.execPath, [join(process.cwd(), "node_modules/next/dist/bin/next"), "start", "--hostname", host, "--port", String(port)], {
      windowsHide: true,
      stdio: "ignore",
      env: {
        ...process.env, NEXT_TELEMETRY_DISABLED: "1", PAVOLLOS_APP_ORIGIN: base,
        SUPABASE_URL: "http://" + host + ":" + upstreamPort,
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_fixture",
      },
    });
    let spawnError;
    app.once("error", (error) => { spawnError = error; });
    stopped = new Promise((resolve) => app.once("close", resolve));

    const request = (path, init) => globalThis.fetch(base + "/api" + path, { ...init, signal: globalThis.AbortSignal.timeout(5000) });
    let health;
    const deadline = Date.now() + 25_000;
    while (!health && !spawnError && app.exitCode === null && Date.now() < deadline) {
      try {
        const candidate = await request("/health");
        if (candidate.ok) health = candidate;
      } catch { /* Aguarda o servidor de teste. */ }
      if (!health) await delay(150);
    }
    assert.ok(health, "O servidor Next.js não iniciou para o teste.");
    assert.deepEqual(await health.json(), { status: "ok" });

    const call = (path, method = "GET", data, cookie = "", origin = base) => request(path, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(method !== "GET" ? { "content-type": "application/json", origin } : {}),
      },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    });
    const login = (address, secret = "in-memory-test") => call("/auth/login", "POST", { email: address, password: secret });
    const assertPrivate = (res) => {
      assert.match(res.headers.get("cache-control") ?? "", /private/);
      assert.match(res.headers.get("cache-control") ?? "", /no-store/);
    };
    const getCookies = (response) => {
      const cookies = response.headers.getSetCookie();
      assert.ok(cookies.some((cookie) => /;\s*httponly\b/i.test(cookie)), "Cookie de sessão HttpOnly ausente.");
      return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
    };

    assert.equal((await call("/auth/me")).status, 401);
    assert.equal((await call("/painel/contexto")).status, 401);
    assert.equal((await call("/auth/login", "POST", { email: user.proprietario.email, password: "x" }, "", "http://example.invalid")).status, 403);
    assert.equal((await login(user.proprietario.email, "senha-incorreta-sintetica")).status, 401);
    assert.equal((await login(user.inativo.email)).status, 403);
    assert.equal((await login(user.auxiliar.email)).status, 403);

    const signedIn = await login(user.proprietario.email);
    assert.equal(signedIn.status, 200);
    assertPrivate(signedIn);
    const cookie = getCookies(signedIn);
    assert.equal((await signedIn.json()).perfil.papel, "proprietario");
    const profile = await expectedJson(await call("/perfil", "GET", undefined, cookie), 200);
    assert.equal(profile.papel, "proprietario");
    const panel = await expectedJson(await call("/painel/contexto", "GET", undefined, cookie), 200);
    assert.equal(typeof panel.estabelecimento, "string");
    assert.ok(panel.atalhos.includes("clientes"));

    assert.equal((await call("/clientes", "POST", { nome: "" }, cookie)).status, 400);
    assert.equal((await call("/clientes/not-uuid", "GET", undefined, cookie)).status, 400);
    const link = { usuario_id: user.auxiliar.id, nome: user.auxiliar.nome, papel: "auxiliar" };
    assert.equal((await call("/usuarios/vincular", "POST", { ...link, papel: "proprietario" }, cookie)).status, 400);
    assert.equal((await expectedJson(await call("/usuarios/vincular", "POST", link, cookie), 201)).id, user.auxiliar.id);

    const assistant = await login(user.auxiliar.email);
    assert.equal(assistant.status, 200);
    const assistantCookie = getCookies(assistant);
    assert.equal((await assistant.json()).perfil.papel, "auxiliar");

    const customer = await expectedJson(await call("/clientes", "POST", { nome: "Cliente sintético" }, assistantCookie), 201);
    assert.equal(customer.nome, "Cliente sintético");
    const service = await expectedJson(await call("/atendimentos", "POST", {
      cliente_id: customer.id, canal_entrada: "whatsapp", descricao: "Atendimento de teste",
    }, assistantCookie), 201);
    assert.equal(service.status, "aberto");
    const quote = await expectedJson(await call("/atendimentos/" + service.id + "/cotacoes", "POST", {
      tipo: "inicial",
    }, assistantCookie), 201);
    const budget = await expectedJson(await call("/cotacoes/" + quote.id + "/orcamentos", "POST", {
      itens: [{ escopo: "Serviço sintético", valor: 120.50 }],
    }, assistantCookie), 201);
    assert.equal(budget.total, 120.50);

    const budgetPath = "/orcamentos/" + budget.id;
    const sent = await expectedJson(await call(budgetPath + "/enviar", "POST", {}, assistantCookie), 200);
    assert.equal(sent.status, "enviado");
    assert.equal(sent.aprovado_em, null);
    const orderPayload = { item_orcamento_id: budget.itens[0].id };
    const rejected = await call("/ordens-servico", "POST", orderPayload, assistantCookie);
    assertPrivate(rejected);
    const conflict = await expectedJson(rejected, 409);
    assert.equal(conflict.error, "conflict");
    assert.doesNotMatch(JSON.stringify(conflict), /Internal database fixture detail/);

    const approved = await expectedJson(await call(budgetPath + "/aprovar", "POST", {
      canal_aceite: "whatsapp", evidencia_aceite: "Aceite explícito sintético",
    }, assistantCookie), 200);
    assert.equal(approved.status, "aprovado");

    const order = await expectedJson(await call("/ordens-servico", "POST", orderPayload, assistantCookie), 200);
    assert.equal(order.status, "aguardando_atribuicao");
    const repeat = await expectedJson(await call("/ordens-servico", "POST", orderPayload, assistantCookie), 200);
    assert.equal(repeat.id, order.id);

    const orderPath = "/ordens-servico/" + order.id;
    const assignment = { tecnico_id: user.tecnico.id };
    assert.equal((await call(orderPath + "/atribuir", "POST", assignment, assistantCookie)).status, 403);
    const assigned = await expectedJson(await call(orderPath + "/atribuir", "POST", assignment, cookie), 200);
    assert.equal(assigned.status, "atribuida");
    assert.equal(assigned.tecnico_id, user.tecnico.id);

    const otherTech = await login(user.outroTecnico.email);
    assert.equal(otherTech.status, 200);
    const otherTechCookie = getCookies(otherTech);
    assert.equal((await call(orderPath, "GET", undefined, otherTechCookie)).status, 404);
    assert.equal((await call(orderPath + "/iniciar", "POST", {}, otherTechCookie)).status, 403);

    const tech = await login(user.tecnico.email);
    assert.equal(tech.status, 200);
    const techCookie = getCookies(tech);
    assert.equal((await call("/clientes", "GET", undefined, techCookie)).status, 403);
    assert.equal((await call(orderPath + "/atribuir", "POST", assignment, techCookie)).status, 403);
    const ownOrders = await expectedJson(await call("/ordens-servico", "GET", undefined, techCookie), 200);
    assert.deepEqual(ownOrders.map((entry) => entry.id), [order.id]);
    const started = await expectedJson(await call(orderPath + "/iniciar", "POST", {}, techCookie), 200);
    assert.equal(started.status, "em_execucao");
    const completed = await expectedJson(await call(orderPath + "/concluir", "POST", {}, techCookie), 200);
    assert.equal(completed.status, "concluida");

    const history = await expectedJson(await call(orderPath + "/historico", "GET", undefined, techCookie), 200);
    assert.equal(history.filter((event) => event.status_novo === "aguardando_atribuicao").length, 1);
    assert.ok(history.some((event) => event.tipo_evento === "atribuicao" && event.tecnico_novo_id === user.tecnico.id));
    assert.ok(history.some((event) => event.status_novo === "concluida" && event.ator_id === user.tecnico.id));
    const merged = await expectedJson(await call("/atendimentos/" + service.id + "/historico", "GET", undefined, cookie), 200);
    assert.ok(merged.some((event) => event.status_novo === "aprovado" && event.orcamento_id === budget.id));
    assert.ok(merged.some((event) => event.status_novo === "concluida" && event.ordem_servico_id === order.id));

    assert.equal((await call("/auth/logout", "POST", {}, cookie)).status, 204);
  } finally {
    if (app && app.exitCode === null) app.kill();
    if (stopped) await stopped;
    await close(upstream);
  }
});
