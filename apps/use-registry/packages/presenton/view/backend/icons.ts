// Slide icons from the vendored bold Phosphor set, as data URLs so slides
// carry them without a server.
import { ICONS, STROKE } from "../vendor/phosphor/icons.js";

const NAMES = Object.keys(ICONS);
const SVG_NS = "http://www.w3.org/2000/svg";

export function iconUrl(name: string): string | null {
  if (!Object.hasOwn(ICONS, name)) return null;
  const inner = ICONS[name].split("~").join(STROKE);
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="${SVG_NS}" viewBox="0 0 256 256">${inner}</svg>`)}`;
}

/** Icons whose exact name holds every query term, exact names first. */
export function searchIcons(query: string, limit: number): string[] {
  const terms = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
  if (!terms.length) return NAMES.slice(0, limit).map((name) => iconUrl(name)!);
  const joined = terms.join("-");
  const ranked = NAMES.filter((name) => terms.every((term) => name.includes(term))).sort(
    (a, b) => Number(b === joined) - Number(a === joined) || a.length - b.length,
  );
  return ranked.slice(0, limit).map((name) => iconUrl(name)!);
}
