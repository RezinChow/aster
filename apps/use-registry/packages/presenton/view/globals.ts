// Installed before any upstream module runs. The sandboxed view has an opaque
// origin and no network: storage is per opening, and requests go to the
// in-page backend.
import { ViewEventSource, viewFetch } from "./backend/server";

class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(String(key)) ?? null;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(String(key));
  }
  setItem(key: string, value: string) {
    this.items.set(String(key), String(value));
  }
}

for (const name of ["localStorage", "sessionStorage"]) {
  Object.defineProperty(window, name, { configurable: true, value: new MemoryStorage() });
}
Object.defineProperty(window, "fetch", { configurable: true, writable: true, value: viewFetch });
Object.defineProperty(window, "EventSource", { configurable: true, writable: true, value: ViewEventSource });
