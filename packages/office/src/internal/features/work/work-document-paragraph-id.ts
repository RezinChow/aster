const PARAGRAPH_ID_PATTERN = /^[0-9A-F]{8}$/;
export const MAX_PARAGRAPH_ID = 0x7fff_ffff;

/** Paragraph ids are shared by import and the editor. Keep this check off the TipTap module so opening a file does not evaluate the editor. */
export function normalizeDocumentParagraphId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (!PARAGRAPH_ID_PATTERN.test(normalized)) return null;
  const number = Number.parseInt(normalized, 16);
  return number > 0 && number <= MAX_PARAGRAPH_ID ? normalized : null;
}
