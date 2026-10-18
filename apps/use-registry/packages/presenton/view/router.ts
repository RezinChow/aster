// The view is one document; upstream's Next.js routes become an in-memory
// location. Routes outside the core flow land on the upload page.
export type Location = { pathname: string; search: string };

const ROUTES = new Set(["/upload", "/outline", "/presentation"]);

let current: Location = { pathname: "/upload", search: "" };
const back: Location[] = [];
const listeners = new Set<() => void>();
const changes = new Set<(location: Location) => void>();

export function parse(href: string): Location {
  const url = new URL(href, "http://view.invalid" + current.pathname);
  const pathname = ROUTES.has(url.pathname) ? url.pathname : "/upload";
  return { pathname, search: pathname === url.pathname ? url.search : "" };
}

function emit() {
  for (const listener of listeners) listener();
  for (const change of changes) change(current);
}

export function navigate(href: string, mode: "push" | "replace") {
  const next = parse(href);
  if (next.pathname === current.pathname && next.search === current.search) return;
  if (mode === "push") back.push(current);
  current = next;
  window.scrollTo(0, 0);
  emit();
}

/** Upstream edits `window.history` directly to drop a finished query flag. */
export function dropSearchParam(name: string) {
  const params = new URLSearchParams(current.search);
  if (!params.has(name)) return;
  params.delete(name);
  const search = params.toString();
  current = { pathname: current.pathname, search: search ? `?${search}` : "" };
  emit();
}

export function goBack() {
  const previous = back.pop();
  if (!previous) return;
  current = previous;
  emit();
}

export function restore(location: Location) {
  current = parse(location.pathname + location.search);
  back.length = 0;
  emit();
}

export function location(): Location {
  return current;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function onLocationChange(change: (location: Location) => void) {
  changes.add(change);
  return () => changes.delete(change);
}
