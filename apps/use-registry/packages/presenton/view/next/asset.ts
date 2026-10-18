// Upstream serves its public files from the site root; the view build copies
// them under public/ beside index.html.
export function assetUrl(src: string): string {
  return src.startsWith("/") && !src.startsWith("//") ? `public${src}` : src;
}
