import assert from "node:assert/strict";
import test from "node:test";
import { dateTime, fields, items, money, optional, pagination, password, required, text, uuid } from "../src/lib/api/validation.ts";

test("campos obrigatórios, desconhecidos e texto vazio", () => {
  const schema = { nome: required(text(10)), telefone: optional(text(20)) };
  assert.deepEqual(fields({ nome: "  Ana  " }, schema), { nome: "Ana" });
  assert.throws(() => fields({}, schema));
  assert.throws(() => fields({ nome: " " }, schema));
  assert.throws(() => fields({ nome: "Ana", papel: "proprietario" }, schema));
  assert.throws(() => fields(JSON.parse('{"nome":"Ana","__proto__":{"ativo":true}}'), schema));
});

test("preço, itens e precisão monetária", () => {
  assert.equal(money(92.15), 92.15);
  assert.throws(() => money(-1));
  assert.throws(() => money(1.234));
  assert.throws(() => money(Infinity));
  assert.deepEqual(items([{ escopo: "Troca", valor: 92.15 }]), [{ escopo: "Troca", valor: 92.15 }]);
  assert.throws(() => items([{ escopo: "", valor: 50 }]));
  assert.throws(() => items([{ escopo: "Troca", valor: "92.15" }]));
});

test("IDs, paginação e validade exigem formato explícito", () => {
  const id = "20000000-0000-4000-8000-000000000005";
  assert.equal(uuid(id), id);
  assert.throws(() => uuid("abc"));
  assert.deepEqual(fields({ limite: "10", deslocamento: "1" }, pagination), { limite: 10, deslocamento: 1 });
  assert.throws(() => fields({ limite: "101" }, pagination));
  assert.throws(() => fields({ deslocamento: "-1" }, pagination));
  assert.equal(dateTime("2026-12-01T18:00:00-03:00"), "2026-12-01T18:00:00-03:00");
  assert.throws(() => dateTime("2026-12-01"));
});

test("validação de senha preserva caracteres e espaços", () => {
  assert.equal(password("  espaço é relevante "), "  espaço é relevante ");
  assert.throws(() => password(""));
});
