// The one presentation a view document holds, in upstream's response shapes
// (PresentationModel, PresentationWithSlides, SlideModel), and its storage in
// the view state: slide `ui` is kept as a diff from what its layout and
// content produce.
import { applyContent } from "./hydrate.js";
import { iconUrl } from "./icons";
import { diff, apply, type Node } from "./patch";
import { storedLayout, template } from "./templates";

export type Settings = {
  content: string;
  n_slides: number;
  language: string;
  tone: string;
  verbosity: string;
  instructions: string | null;
  include_title_slide: boolean;
};

export type StoredSlide = {
  id: string;
  group: string;
  layout: string;
  content: Record<string, unknown>;
  note: string;
  patch: Node | null;
};

export type Deck = Settings & {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  outlines: string[] | null;
  template: string | null;
  structure: string[] | null;
  slides: StoredSlide[];
};

export type SlideModel = {
  id: string;
  presentation: string;
  layout_group: string;
  layout: string;
  index: number;
  content: Record<string, unknown>;
  html_content: null;
  speaker_note: string;
  properties: null;
  ui: Record<string, unknown> | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function uuid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const now = () => new Date().toISOString();

/** Content as the editor sees it: each icon query carries its icon. */
export function withAssets(content: unknown): any {
  if (Array.isArray(content)) return content.map(withAssets);
  if (!isRecord(content)) return content;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(content)) out[key] = withAssets(value);
  if (typeof content.icon_query === "string") {
    const url = iconUrl(content.icon_query.trim());
    if (url) out.__icon_url__ = url;
  }
  return out;
}

/** The reverse of `withAssets`: icons that follow from their query are not stored. */
function withoutDerivedAssets(content: unknown): any {
  if (Array.isArray(content)) return content.map(withoutDerivedAssets);
  if (!isRecord(content)) return content;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(content)) out[key] = withoutDerivedAssets(value);
  if (typeof content.icon_query === "string" && content.__icon_url__ === iconUrl(content.icon_query.trim())) delete out.__icon_url__;
  return out;
}

/** The `ui` a slide's layout and content produce, or null for a layout this deck has no template for. */
export function baseUi(group: string, layoutId: string, content: Record<string, unknown>) {
  const layout = template(group)?.layouts.find((entry) => entry.id === layoutId);
  if (!layout) return null;
  const ui = applyContent(layout, withAssets(content));
  return storedLayout(ui);
}

export function slideModel(deck: Deck, slide: StoredSlide, index: number): SlideModel {
  const base = baseUi(slide.group, slide.layout, slide.content);
  const ui = apply(base, slide.patch) as Record<string, unknown> | null;
  return {
    id: slide.id,
    presentation: deck.id,
    layout_group: slide.group,
    layout: slide.layout,
    index,
    content: withAssets(slide.content),
    html_content: null,
    speaker_note: slide.note,
    properties: null,
    ui: isRecord(ui) ? ui : null,
  };
}

/** Store an editor slide; anything not a record is refused by the caller. */
export function storedSlide(slide: Record<string, any>): StoredSlide {
  const group = typeof slide.layout_group === "string" ? slide.layout_group : "";
  const layout = typeof slide.layout === "string" ? slide.layout : "";
  const content = withoutDerivedAssets(isRecord(slide.content) ? slide.content : {});
  const base = baseUi(group, layout, content);
  const ui = isRecord(slide.ui) ? slide.ui : null;
  return {
    id: typeof slide.id === "string" && slide.id ? slide.id : uuid(),
    group,
    layout,
    content,
    note: typeof slide.speaker_note === "string" ? slide.speaker_note : "",
    patch: ui === null ? (base === null ? null : ["v", null]) : diff(base, ui),
  };
}

export function presentationModel(deck: Deck) {
  return {
    id: deck.id,
    version: "v2-standard",
    content: deck.content,
    n_slides: deck.n_slides,
    language: deck.language,
    title: deck.title,
    file_paths: [],
    outlines: deck.outlines ? { slides: deck.outlines.map((content) => ({ content })) } : null,
    created_at: deck.created_at,
    updated_at: deck.updated_at,
    instructions: deck.instructions,
    tone: deck.tone,
    verbosity: deck.verbosity,
    include_table_of_contents: false,
    include_title_slide: deck.include_title_slide,
    web_search: false,
    theme: null,
    fonts: {},
    generation_mode: "standard",
    community_design_ids: null,
  };
}

export function presentationWithSlides(deck: Deck, slides: SlideModel[] = deck.slides.map((slide, index) => slideModel(deck, slide, index))) {
  const { outlines, file_paths, instructions, include_table_of_contents, include_title_slide, web_search, ...rest } = presentationModel(deck);
  return { ...rest, type: "standard", slides };
}
