// Upstream's generation streams, driven by agent turns: the outline
// (outlines.py stream_outlines), the layout pick (presentation.py
// prepare_presentation) and each slide (presentation.py stream_presentation).
import { invoke } from "../host";
import { now, presentationModel, presentationWithSlides, slideModel, uuid, type Deck, type StoredSlide } from "./deck";
import { deck, setDeck } from "./state";
import { template } from "./templates";

export type StreamEvent = Record<string, unknown> & { type: string };

const status = (text: string): StreamEvent => ({ type: "status", status: text });
const failure = (detail: string): StreamEvent => ({ type: "error", detail });

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function current(id: string): Deck | null {
  return deck && deck.id === id ? deck : null;
}

function update(id: string, change: (deck: Deck) => Deck) {
  const existing = current(id);
  if (existing) setDeck({ ...change(existing), updated_at: now() });
}

/** A presentation title is the first outline's heading, as upstream reads it. */
function titleOf(outlines: string[]): string | null {
  for (const line of (outlines[0] ?? "").split("\n")) {
    const heading = /^#{1,6}\s+(.+)$/.exec(line.trim());
    if (heading) return heading[1].trim();
  }
  return null;
}

export async function* outlineStream(id: string, isOpen: () => boolean): AsyncGenerator<StreamEvent> {
  const found = current(id);
  if (!found) {
    yield failure("没有找到这个演示文稿。");
    return;
  }
  if (found.outlines?.length) {
    yield { type: "chunk", chunk: JSON.stringify({ slides: found.outlines.map((content) => ({ content })) }) };
    yield { type: "complete", presentation: presentationModel(found) };
    return;
  }
  yield status("正在准备演示文稿大纲");
  let result;
  try {
    result = await invoke({
      step: "outline",
      content: found.content,
      n_slides: found.n_slides > 0 ? found.n_slides : null,
      language: found.language,
      tone: found.tone,
      verbosity: found.verbosity,
      instructions: found.instructions ?? "",
      include_title_slide: found.include_title_slide,
    });
  } catch (error) {
    yield failure(message(error));
    return;
  }
  if (!isOpen()) return;
  const outlines: string[] = result.outline;
  yield { type: "chunk", chunk: JSON.stringify({ slides: outlines.map((content) => ({ content })) }) };
  update(id, (deck) => ({ ...deck, outlines, title: titleOf(outlines), n_slides: deck.n_slides > 0 ? deck.n_slides : outlines.length }));
  const saved = current(id);
  if (saved) yield { type: "complete", presentation: presentationModel(saved) };
}

/** `prepare`: store the reviewed outline and pick a layout for each slide. */
export async function prepare(body: any) {
  const found = typeof body?.presentation_id === "string" ? current(body.presentation_id) : null;
  if (!found) return { status: 404, body: { detail: "没有找到这个演示文稿。" } };
  const outlines = Array.isArray(body.outlines)
    ? body.outlines.map((slide: any) => (typeof slide?.content === "string" ? slide.content.trim() : "")).filter(Boolean)
    : [];
  if (!outlines.length) return { status: 400, body: { detail: "大纲不能为空。" } };
  const chosen = template(String(body.layout ?? ""));
  if (!chosen) return { status: 404, body: { detail: "没有找到这个模板。" } };
  let structure: string[];
  try {
    const result = await invoke({
      step: "structure",
      template: chosen.id,
      outline: outlines,
      instructions: found.instructions ?? "",
      content: found.content,
    });
    structure = result.layouts;
  } catch (error) {
    return { status: 502, body: { detail: message(error) } };
  }
  update(found.id, (deck) => ({
    ...deck,
    outlines,
    n_slides: outlines.length,
    title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : deck.title ?? titleOf(outlines),
    template: chosen.id,
    structure,
    slides: [],
  }));
  return { status: 200, body: { presentation_id: found.id } };
}

/**
 * Slides stream one turn each. A stream over an unfinished deck sends the
 * slides already made first, so a retry or reopen continues where the last
 * stream stopped; a stream over a finished deck regenerates it.
 */
export async function* slideStream(id: string, isOpen: () => boolean): AsyncGenerator<StreamEvent> {
  const found = current(id);
  if (!found) {
    yield failure("没有找到这个演示文稿。");
    return;
  }
  if (!found.structure || !found.outlines || !found.template) {
    yield failure("演示文稿还没有准备好生成。");
    return;
  }
  const { structure, outlines, template: templateId } = found;
  if (found.slides.length >= structure.length) update(id, (deck) => ({ ...deck, slides: [] }));
  yield { type: "chunk", chunk: '{ "slides": [ ' };
  for (let index = 0; index < structure.length; index += 1) {
    const deckNow = current(id);
    if (!deckNow) return;
    let slide: StoredSlide | undefined = deckNow.slides[index];
    if (!slide) {
      let result;
      try {
        result = await invoke({
          step: "slide",
          template: templateId,
          layout: structure[index],
          outline: outlines[index],
          slide_number: index + 1,
          language: deckNow.language,
          tone: deckNow.tone,
          verbosity: deckNow.verbosity,
          instructions: deckNow.instructions ?? "",
        });
      } catch (error) {
        yield failure(message(error));
        return;
      }
      if (!isOpen()) return;
      const content = result.content && typeof result.content === "object" ? result.content : {};
      const note = typeof content.__speaker_note__ === "string" ? content.__speaker_note__ : "";
      slide = { id: uuid(), group: templateId, layout: structure[index], content, note, patch: null };
      const made = slide;
      update(id, (deck) => ({ ...deck, slides: [...deck.slides.slice(0, index), made] }));
    }
    const saved = current(id);
    if (!saved) return;
    yield { type: "chunk", chunk: JSON.stringify(slideModel(saved, slide, index)) };
  }
  yield { type: "chunk", chunk: " ] }" };
  const done = current(id);
  if (done) yield { type: "complete", presentation: presentationWithSlides(done) };
}
