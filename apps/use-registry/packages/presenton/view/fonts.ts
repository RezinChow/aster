// The editor's font catalog: the fonts this package ships (fonts/), in the
// shape of upstream's LocalFontOption.
type Face = { sourceUrl: string; style: "italic" | "normal"; weight: number | string };
type FontOption = { family: string; sourceUrl: string; italicSourceUrl?: string; faces?: Face[] };

function shipped(family: string, slug: string, faces: [number, "normal" | "italic"][]): FontOption {
  const all = faces.map(([weight, style]) => ({ sourceUrl: `fonts/${slug}-latin-${weight}-${style}.woff2`, style, weight }));
  const italic = all.find((face) => face.style === "italic" && face.weight === 400);
  return { family, sourceUrl: all[0].sourceUrl, ...(italic ? { italicSourceUrl: italic.sourceUrl } : {}), faces: all };
}

export const VIEW_LOCAL_FONT_OPTIONS: FontOption[] = [
  shipped("Albert Sans", "albert-sans", [[400, "normal"], [700, "normal"]]),
  shipped("Inter", "inter", [[400, "normal"], [700, "normal"]]),
  { family: "Manrope", sourceUrl: "fonts/manrope.woff2", faces: [{ sourceUrl: "fonts/manrope.woff2", style: "normal", weight: "200 800" }] },
  shipped("Montserrat", "montserrat", [[400, "normal"], [700, "normal"]]),
  shipped("Playfair Display", "playfair-display", [[400, "normal"], [700, "normal"]]),
  shipped("Poppins", "poppins", [[400, "normal"], [700, "normal"], [400, "italic"], [700, "italic"]]),
];

export const VIEW_APPLICATION_FONT_OPTIONS: FontOption[] = [
  { family: "Syne", sourceUrl: "fonts/syne.woff2", faces: [{ sourceUrl: "fonts/syne.woff2", style: "normal", weight: "400 800" }] },
];
