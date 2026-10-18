/** Shared image crop helpers (cover-fit + pan/zoom → data URL). */

export type CropState = {
  img: HTMLImageElement;
  zoom: number;
  x: number;
  y: number;
};

export type CropAspect = {
  /** Viewport / export aspect width */
  width: number;
  /** Viewport / export aspect height */
  height: number;
};

export function coverScale(
  img: HTMLImageElement,
  viewW: number,
  viewH: number,
): number {
  return Math.max(viewW / img.width, viewH / img.height);
}

export function clampOffset(
  img: HTMLImageElement,
  viewW: number,
  viewH: number,
  zoom: number,
  x: number,
  y: number,
): { x: number; y: number } {
  const scale = coverScale(img, viewW, viewH) * zoom;
  const maxX = Math.max(0, (img.width * scale - viewW) / 2);
  const maxY = Math.max(0, (img.height * scale - viewH) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, x)),
    y: Math.min(maxY, Math.max(-maxY, y)),
  };
}

export function paintCrop(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  viewW: number,
  viewH: number,
  zoom: number,
  x: number,
  y: number,
): void {
  const offset = clampOffset(img, viewW, viewH, zoom, x, y);
  const scale = coverScale(img, viewW, viewH) * zoom;
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.clearRect(0, 0, viewW, viewH);
  ctx.drawImage(
    img,
    (viewW - dw) / 2 + offset.x,
    (viewH - dh) / 2 + offset.y,
    dw,
    dh,
  );
}

export function exportCroppedDataUrl(
  crop: CropState,
  viewW: number,
  viewH: number,
  outW: number,
  outH: number,
  maxBytes = 900_000,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.scale(outW / viewW, outH / viewH);
  paintCrop(ctx, crop.img, viewW, viewH, crop.zoom, crop.x, crop.y);
  let quality = 0.92;
  let out = canvas.toDataURL('image/jpeg', quality);
  while (out.length > maxBytes && quality > 0.5) {
    quality -= 0.08;
    out = canvas.toDataURL('image/jpeg', quality);
  }
  if (out.length > maxBytes) throw new Error('too-large');
  return out;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode'));
    img.src = src;
  });
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

export function isCroppableImageFile(file: File): boolean {
  return (
    file.type.startsWith('image/') &&
    file.type !== 'image/svg+xml' &&
    file.type !== 'image/gif'
  );
}
