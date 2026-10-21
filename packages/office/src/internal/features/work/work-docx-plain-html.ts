const PLAIN_DOCX_TAG =
  /<\/?((?:[A-Za-z_][\w.-]*:)?)([A-Za-z_][\w.-]*)\b[^>]*\/?>/g;
const PLAIN_DOCX_PARAGRAPH = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
const PLAIN_DOCX_TEXT = /<w:t\b([^>]*)>([\s\S]*?)<\/w:t>/g;
const PLAIN_DOCX_SECTION = /<w:sectPr\b[\s\S]*?<\/w:sectPr>/g;
const DEFAULT_STYLE_PROPERTIES =
  /<w:(pPrDefault|rPrDefault)\b([^>]*)>([\s\S]*?)<\/w:\1>/g;

/**
 * Mammoth HTML for a body made only of plain text paragraphs.
 * Any other WordprocessingML element returns null so the full importer runs.
 */
export function plainDocxParagraphHtml(documentXml: string): string | null {
  const bodyMatch = documentXml.match(/<w:body\b[^>]*>([\s\S]*)<\/w:body>/);
  if (!bodyMatch) return null;
  const body = bodyMatch[1].replace(PLAIN_DOCX_SECTION, '');
  PLAIN_DOCX_TAG.lastIndex = 0;
  for (let tag = PLAIN_DOCX_TAG.exec(body); tag; tag = PLAIN_DOCX_TAG.exec(body)) {
    if (tag[1] !== 'w:' || !['p', 'r', 't'].includes(tag[2])) return null;
  }
  const paragraphs: string[] = [];
  PLAIN_DOCX_PARAGRAPH.lastIndex = 0;
  for (
    let paragraph = PLAIN_DOCX_PARAGRAPH.exec(body);
    paragraph;
    paragraph = PLAIN_DOCX_PARAGRAPH.exec(body)
  ) {
    if (paragraph[1].includes('<w:p')) return null;
    let text = '';
    PLAIN_DOCX_TEXT.lastIndex = 0;
    for (
      let node = PLAIN_DOCX_TEXT.exec(paragraph[1]);
      node;
      node = PLAIN_DOCX_TEXT.exec(paragraph[1])
    ) {
      if (node[2].includes('<')) return null;
      text += decodeXmlText(node[2]);
    }
    paragraphs.push(`<p>${escapeHtml(text)}</p>`);
  }
  if (!paragraphs.length) return null;
  const leftover = body.replace(/<w:p\b[\s\S]*?<\/w:p>/g, '').trim();
  return leftover ? null : paragraphs.join('');
}

/** Default paragraph or run properties can decorate a body that has no direct pPr. */
export function docxDefaultStylesAffectParagraphs(stylesXml: string): boolean {
  DEFAULT_STYLE_PROPERTIES.lastIndex = 0;
  for (
    let match = DEFAULT_STYLE_PROPERTIES.exec(stylesXml);
    match;
    match = DEFAULT_STYLE_PROPERTIES.exec(stylesXml)
  ) {
    if (match[2]?.endsWith('/')) continue;
    if (/<w:[A-Za-z]/.test(match[3] ?? '')) return true;
  }
  return false;
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number(decimal)),
    )
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
