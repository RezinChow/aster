// The bundled templates, answered in the shapes of upstream's template routes
// (servers/fastapi/api/v1/ppt/endpoints/template.py).
import general from "../vendor/templates/general.js";
import modern from "../vendor/templates/modern.js";
import standard from "../vendor/templates/standard.js";
import swift from "../vendor/templates/swift.js";

export type Layout = { id: string; repeated?: unknown; [key: string]: unknown };
export type Template = {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  icon_type: string;
  theme: Record<string, unknown> | null;
  merged_components: unknown;
  layouts: Layout[];
};

const TEMPLATES: Template[] = [general, modern, standard, swift];
const BY_ID = new Map(TEMPLATES.map((template) => [template.id, template]));
const EPOCH = "2026-01-01T00:00:00Z";

export function template(id: string): Template | null {
  return BY_ID.get(id) ?? null;
}

/** A layout as stored in upstream's template rows: without the vendor-time repeat map. */
export function storedLayout(layout: Layout) {
  const { repeated, ...rest } = layout;
  return rest;
}

function summary(template: Template) {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    layout_count: template.layouts.length,
    thumbnail: template.thumbnail,
    preview_url: null,
    is_default: true,
    created_at: EPOCH,
    updated_at: EPOCH,
  };
}

export function listTemplates(query: URLSearchParams) {
  const page = Math.max(1, Number(query.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.get("page_size") ?? 20) || 20));
  const items = query.get("default") === "false" ? [] : TEMPLATES.map(summary);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, page_size: pageSize };
}

export function templateDetail(template: Template) {
  return {
    ...summary(template),
    merged_components: template.merged_components,
    layouts: { layouts: template.layouts.map(storedLayout) },
    theme: template.theme,
    fonts: {},
  };
}

/** `presentation.layout` after prepare (`_copy_template_layout_payload`). */
export function layoutPayload(template: Template) {
  return {
    layouts: template.layouts.map(storedLayout),
    icon_type: template.icon_type,
    icon_weight: template.icon_type,
    name: template.id,
    template_id: template.id,
  };
}
