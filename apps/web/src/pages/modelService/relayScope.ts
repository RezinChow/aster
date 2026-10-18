/** Model-service suppliers whose name matches this commerce partner. */
export function scopedRelaySuppliers<T extends { id: string; name: string }>(
  suppliers: readonly T[],
  partnerNames: readonly string[],
): T[] {
  const wanted = new Set(
    partnerNames.map((name) => name.trim().toLowerCase()).filter((name) => name.length > 0),
  );
  if (wanted.size === 0) return [];
  return suppliers.filter((supplier) => wanted.has(supplier.name.trim().toLowerCase()));
}
