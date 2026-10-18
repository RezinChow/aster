// Upstream's frontend talks to its FastAPI server through fetch and
// EventSource. The view has no network, so both are answered here, in the
// page, from the deck in view state and this package's agent.
import { commitSlide, writeOutlines } from "./deckControl";
import { now, presentationModel, presentationWithSlides, slideModel, storedSlide, uuid, type Deck } from "./deck";
import { outlineStream, prepare, slideStream, type StreamEvent } from "./generate";
import { searchIcons } from "./icons";
import { holdsOutlineWork, HOME_SEED_KEPT_NOTICE } from "./homeSeed";
import { deck, setDeck } from "./state";
import { listTemplates, template, templateDetail } from "./templates";

export const MAX_SLIDES = 20;
const UNSUPPORTED = "演示文稿插件不支持这个功能。";

type Reply = { status: number; body: unknown };
const ok = (body: unknown): Reply => ({ status: 200, body });
const fail = (status: number, detail: string): Reply => ({ status, body: { detail } });

function readBody(init?: RequestInit): any {
  if (typeof init?.body !== "string") return null;
  try {
    return JSON.parse(init.body);
  } catch {
    return null;
  }
}

const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");

function create(body: any): Reply {
  if (!body || typeof body !== "object") return fail(422, "请求格式不正确。");
  if (body.generation_mode === "smart") return fail(400, UNSUPPORTED);
  if (body.include_table_of_contents) return fail(400, "暂不支持自动生成目录页。");
  if (Array.isArray(body.file_paths) && body.file_paths.length) return fail(400, "暂不支持从文档生成。");
  const content = text(body.content, 12000).trim();
  if (!content) return fail(400, "请先输入主题或内容。");
  if (holdsOutlineWork()) return fail(409, HOME_SEED_KEPT_NOTICE);
  const n = body.n_slides === null || body.n_slides === undefined ? 0 : Number(body.n_slides);
  if (!Number.isInteger(n) || n < 0 || n > MAX_SLIDES) return fail(400, `页数需在 1 到 ${MAX_SLIDES} 之间。`);
  const created = now();
  const next: Deck = {
    id: uuid(),
    created_at: created,
    updated_at: created,
    content,
    n_slides: n,
    language: text(body.language, 200),
    tone: text(body.tone, 40) || "default",
    verbosity: text(body.verbosity, 40) || "standard",
    instructions: text(body.instructions, 4000) || null,
    include_title_slide: body.include_title_slide !== false,
    title: null,
    outlines: null,
    template: null,
    structure: null,
    slides: [],
  };
  setDeck(next);
  return ok(presentationModel(next));
}

function ownDeck(id: string | null | undefined): Deck | null {
  return deck && id && deck.id === id ? deck : null;
}

function updateDeck(body: any): Reply {
  const found = ownDeck(body?.id);
  if (!found) return fail(404, "没有找到这个演示文稿。");
  const next: Deck = { ...found, updated_at: now() };
  if (typeof body.title === "string" && body.title.trim()) next.title = body.title.trim().slice(0, 500);
  if (Array.isArray(body.slides) && body.slides.length) {
    if (body.slides.length > MAX_SLIDES) return fail(400, `最多 ${MAX_SLIDES} 页。`);
    if (!body.slides.every((slide: unknown) => slide && typeof slide === "object")) return fail(422, "幻灯片格式不正确。");
    next.slides = body.slides.map(storedSlide);
  }
  setDeck(next);
  return ok(presentationWithSlides(next, Array.isArray(body.slides) ? next.slides.map((slide, index) => slideModel(next, slide, index)) : []));
}

function updateSlide(body: any): Reply {
  const slide = body?.slide;
  const found = ownDeck(slide?.presentation);
  if (!found) return fail(404, "没有找到这个演示文稿。");
  if (!slide || found.slides.every((entry) => entry.id !== slide.id)) return fail(404, "没有找到这页幻灯片。");
  const saved = commitSlide(slide);
  if (!saved) return fail(404, "没有找到这页幻灯片。");
  return ok(slideModel(saved.deck, saved.stored, saved.index));
}

async function route(method: string, url: URL, init?: RequestInit): Promise<Reply> {
  const path = url.pathname;
  const parts = path.split("/").filter(Boolean);
  if (path === "/api/telemetry-status") return ok({ telemetryEnabled: false });
  if (path.startsWith("/api/v1/ppt/template/")) {
    if (method !== "GET") return fail(501, UNSUPPORTED);
    if (parts[4] === "all") return ok(listTemplates(url.searchParams));
    const found = template(decodeURIComponent(parts[4] ?? ""));
    if (!found) return fail(404, "没有找到这个模板。");
    if (parts.length === 5) return ok(templateDetail(found));
    if (parts.length === 6 && parts[5] === "theme") return ok({ template_id: found.id, theme: found.theme });
    return fail(501, UNSUPPORTED);
  }
  if (path === "/api/v1/ppt/icons/search") {
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20));
    return ok(searchIcons(url.searchParams.get("query") ?? "", limit));
  }
  // The image library is empty: the view has no image model, no network for
  // stock photos, and its 64 KiB state cannot hold uploaded images.
  if ((path === "/api/v1/ppt/images/uploaded" || path === "/api/v1/ppt/images/generated") && method === "GET") return ok([]);
  if (path === "/api/v1/ppt/images/search") return fail(501, "本插件不能联网搜索图片。");
  if (path === "/api/v1/ppt/images/generate") return fail(501, "本插件不能生成图片。");
  if (path === "/api/v1/ppt/images/upload") return fail(501, "本插件不能上传图片。");
  if (path === "/api/v1/ppt/presentation/create" && method === "POST") return create(readBody(init));
  if (path === "/api/v1/ppt/presentation/prepare" && method === "POST") return prepare(readBody(init));
  if (path === "/api/v1/ppt/presentation/update" && method === "PATCH") return updateDeck(readBody(init));
  if (path === "/api/v1/ppt/presentation/slide_update" && method === "PATCH") return updateSlide(readBody(init));
  if (parts.length === 5 && parts[3] === "outlines") {
    const found = ownDeck(parts[4]);
    if (!found) return fail(404, "没有找到这个演示文稿。");
    if (method === "GET") return found.outlines ? ok({ slides: found.outlines.map((content) => ({ content })) }) : fail(404, "大纲还没有生成。");
    if (method === "PUT") {
      const body = readBody(init);
      const outlines = Array.isArray(body?.slides) ? body.slides.map((slide: any) => text(slide?.content, 4000)).slice(0, MAX_SLIDES) : null;
      if (!outlines) return fail(422, "大纲格式不正确。");
      if (!writeOutlines(found.id, outlines)) return fail(404, "没有找到这个演示文稿。");
      return ok({ slides: outlines.map((content: string) => ({ content })) });
    }
  }
  if (parts.length === 5 && parts[3] === "presentation" && method === "GET") {
    const found = ownDeck(parts[4]);
    return found ? ok(presentationWithSlides(found)) : fail(404, "没有找到这个演示文稿。");
  }
  return fail(501, UNSUPPORTED);
}

export async function viewFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const url = new URL(href, "http://view.invalid/");
  let reply: Reply;
  try {
    reply = await route(method, url, init);
  } catch (error) {
    console.error("presenton view backend", error);
    reply = fail(500, "处理请求时出错。");
  }
  return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { "content-type": "application/json" } });
}

const STREAMS: [RegExp, (id: string, isOpen: () => boolean) => AsyncGenerator<StreamEvent>][] = [
  [/^\/api\/v1\/ppt\/outlines\/stream\/([^/]+)$/, outlineStream],
  [/^\/api\/v1\/ppt\/presentation\/stream\/([^/]+)$/, slideStream],
];

/** Server-sent events from the generators above, as named `response` events. */
export class ViewEventSource extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSED = 2;
  readonly url: string;
  readonly withCredentials = false;
  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string | URL) {
    super();
    this.url = String(url);
    queueMicrotask(() => void this.run());
  }

  close() {
    this.readyState = 2;
  }

  private emit(event: Event) {
    this.dispatchEvent(event);
    const handler = event.type === "open" ? this.onopen : event.type === "error" ? this.onerror : event.type === "message" ? this.onmessage : null;
    handler?.call(this, event as MessageEvent);
  }

  private async run() {
    const path = new URL(this.url, "http://view.invalid/").pathname;
    const match = STREAMS.map(([pattern, stream]) => [pattern.exec(path), stream] as const).find(([found]) => found);
    if (this.readyState === 2) return;
    if (!match) {
      this.readyState = 2;
      this.emit(new Event("error"));
      return;
    }
    this.readyState = 1;
    this.emit(new Event("open"));
    const isOpen = () => this.readyState !== 2;
    try {
      for await (const data of match[1](decodeURIComponent(match[0]![1]), isOpen)) {
        if (!isOpen()) return;
        this.emit(new MessageEvent("response", { data: JSON.stringify(data) }));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } catch (error) {
      console.error("presenton view stream", error);
      if (isOpen()) this.emit(new MessageEvent("response", { data: JSON.stringify({ type: "error", detail: "生成时出错。" }) }));
    }
    this.readyState = 2;
  }
}
