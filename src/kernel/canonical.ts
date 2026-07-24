import { createHash } from "node:crypto";

export type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalValue[]
  | { readonly [key: string]: CanonicalValue };

export function canonicalJson(value: CanonicalValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("KERNEL_NON_CANONICAL_NUMBER");
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(",")}}`;
}

export function domainHash(kind: string, value: CanonicalValue): string {
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(kind)) throw new Error("KERNEL_INVALID_HASH_DOMAIN");
  return createHash("sha256")
    .update(`alphadawg:a2:${kind}:v1:${canonicalJson(value)}`, "utf8")
    .digest("hex");
}
