import type { Input } from "./http";

class InvalidInput extends Error {}

type Validator = (value: unknown) => unknown;
type Field = { validate: Validator; optional?: true };
export type Fields = Record<string, Field>;

function reject(): never {
  throw new InvalidInput();
}

export function fields(input: Input, schema: Fields): Input {
  for (const key of Object.keys(input)) {
    if (!Object.hasOwn(schema, key)) throw new Error("Campo não reconhecido.");
  }
  const output: Input = {};
  for (const [key, field] of Object.entries(schema)) {
    if (!Object.hasOwn(input, key)) {
      if (field.optional) continue;
      throw new Error(`Campo obrigatório: ${key}`);
    }
    try {
      output[key] = field.validate(input[key]);
    } catch (error) {
      if (!(error instanceof InvalidInput)) throw error;
      throw new Error(`Campo inválido: ${key}`, { cause: error });
    }
  }
  return output;
}

export const required = (validate: Validator): Field => ({ validate });
export const optional = (validate: Validator): Field => ({ validate, optional: true });
export const nullable = (validate: Validator): Validator => (value) => value === null ? null : validate(value);

export function text(max: number): Validator {
  return (value) => {
    if (typeof value !== "string" || value.length > max || !value.trim()) reject();
    return value.trim();
  };
}

export function choice(...allowed: string[]): Validator {
  return (value) => {
    if (typeof value !== "string" || !allowed.includes(value)) reject();
    return value;
  };
}

export const uuid: Validator = (value) => {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) reject();
  return value;
};

export const email: Validator = (value) => {
  if (typeof value !== "string" || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) reject();
  return value.trim();
};

export const password: Validator = (value) => {
  if (typeof value !== "string" || !value.length || value.length > 1024) reject();
  return value;
};

export const dateTime: Validator = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
    || !Number.isFinite(Date.parse(value))) reject();
  return value;
};

export const money: Validator = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 9_999_999_999.99
    || Math.abs(value - Math.round(value * 100) / 100) > 1e-9) reject();
  return value;
};

export const itemFields = { escopo: required(text(1000)), valor: required(money) };

export const items: Validator = (value) => {
  if (!Array.isArray(value) || value.length > 100) reject();
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) reject();
    try {
      return fields(entry as Input, itemFields);
    } catch {
      return reject();
    }
  });
};

function integer(min: number, max: number): Validator {
  return (value) => {
    if (typeof value !== "string" || !/^\d+$/.test(value)) reject();
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < min || n > max) reject();
    return n;
  };
}

export const pagination = { limite: optional(integer(1, 100)), deslocamento: optional(integer(0, 10_000)) };
