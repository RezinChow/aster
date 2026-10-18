// A compact JSON diff, so a slide's edited `ui` is stored as its difference
// from the `ui` its layout and content produce.
//   ["v", value]                 replace
//   ["o", {key: node}, [gone]]   object: changed keys, removed keys
//   ["a", {index: node}]         array of the same length: changed items
export type Node = ["v", unknown] | ["o", Record<string, Node>, string[]] | ["a", Record<string, Node>];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function diff(base: unknown, next: unknown): Node | null {
  if (Object.is(base, next)) return null;
  if (isRecord(base) && isRecord(next)) {
    const changed: Record<string, Node> = {};
    const gone = Object.keys(base).filter((key) => !Object.hasOwn(next, key));
    for (const key of Object.keys(next)) {
      const node = Object.hasOwn(base, key) ? diff(base[key], next[key]) : (["v", next[key]] as Node);
      if (node) changed[key] = node;
    }
    return Object.keys(changed).length || gone.length ? ["o", changed, gone] : null;
  }
  if (Array.isArray(base) && Array.isArray(next) && base.length === next.length) {
    const changed: Record<string, Node> = {};
    next.forEach((item, index) => {
      const node = diff(base[index], item);
      if (node) changed[index] = node;
    });
    return Object.keys(changed).length ? ["a", changed] : null;
  }
  if (typeof base !== "object" && base === next) return null;
  return JSON.stringify(base) === JSON.stringify(next) ? null : ["v", next];
}

/** `base` with `node` applied; `base` is not changed. */
export function apply(base: unknown, node: Node | null): unknown {
  if (!node) return structuredClone(base);
  if (node[0] === "v") return structuredClone(node[1]);
  if (node[0] === "o") {
    const out: Record<string, unknown> = isRecord(base) ? structuredClone(base) : {};
    for (const key of node[2]) delete out[key];
    for (const [key, child] of Object.entries(node[1])) out[key] = apply(isRecord(base) ? base[key] : undefined, child);
    return out;
  }
  const out = Array.isArray(base) ? structuredClone(base) : [];
  for (const [index, child] of Object.entries(node[1])) out[Number(index)] = apply(out[Number(index)], child);
  return out;
}
