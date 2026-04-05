// Tiny deterministic 32-bit hash (FNV-1a). Used to seed specialist rotation
// jitter from (userId, cycleId) without pulling in a crypto dependency. The
// same input always maps to the same output so HCS replays stay reproducible.

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function fnv1a(input: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // Force 32-bit multiplication via Math.imul
    hash = Math.imul(hash, FNV_PRIME);
  }
  // Coerce to unsigned 32-bit so downstream modulo math is always positive.
  return hash >>> 0;
}
