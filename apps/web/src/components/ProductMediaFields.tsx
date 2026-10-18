import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@a3s-lab/ui';
import { SupplierAvatar } from '@/components/SupplierAvatar';
import {
  clampOffset,
  exportCroppedDataUrl,
  isCroppableImageFile,
  loadImage,
  paintCrop,
  readFileAsDataUrl,
  type CropState,
} from '@/lib/imageCrop';
import { useI18n } from '@/i18n/useI18n';

export type ProductMediaKind = 'logo' | 'cover';

type CropTarget = {
  kind: ProductMediaKind;
  crop: CropState;
};

const LOGO_VIEW = 240;
const LOGO_OUT = 256;
const COVER_VIEW_W = 320;
const COVER_VIEW_H = 180;
const COVER_OUT_W = 1280;
const COVER_OUT_H = 720;

export type ProductMediaLabels = {
  logo?: string;
  logoSpec?: string;
  logoEmpty?: string;
  cropLogoTitle?: string;
  hint?: string;
};

export type ProductMediaFieldsProps = {
  logoUrl: string;
  onLogoChange: (url: string) => void;
  /** When omitted / showCover=false, only the logo slot is shown. */
  coverUrl?: string;
  onCoverChange?: (url: string) => void;
  /** Default true. Set false for avatar/logo-only flows (e.g. suppliers). */
  showCover?: boolean;
  /** Logo preview shape. Crop remains 1:1 either way. */
  logoShape?: 'square' | 'round';
  labels?: ProductMediaLabels;
  placeholderLogo?: string;
  placeholderCover?: string;
  /** Notify parent when crop UI is active (hide create footer). */
  onCroppingChange?: (cropping: boolean) => void;
  /** Show the current logo without upload, replace, or remove. */
  readOnly?: boolean;
};

/**
 * E-commerce / profile media: preview → upload → inline pan/zoom crop.
 * Logo 1:1 · Cover 16:9 (optional). Crop is in-form (no nested dialog).
 */
export function ProductMediaFields({
  logoUrl,
  coverUrl = '',
  onLogoChange,
  onCoverChange,
  showCover = true,
  logoShape = 'square',
  labels,
  placeholderLogo,
  placeholderCover,
  onCroppingChange,
  readOnly = false,
}: ProductMediaFieldsProps) {
  const { t } = useI18n();
  const logoFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ px: number; py: number; x: number; y: number } | null>(
    null,
  );
  const [target, setTarget] = useState<CropTarget | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [cropError, setCropError] = useState<string | null>(null);
  const zoomId = useId();

  const viewW = target?.kind === 'cover' ? COVER_VIEW_W : LOGO_VIEW;
  const viewH = target?.kind === 'cover' ? COVER_VIEW_H : LOGO_VIEW;
  const outW = target?.kind === 'cover' ? COVER_OUT_W : LOGO_OUT;
  const outH = target?.kind === 'cover' ? COVER_OUT_H : LOGO_OUT;

  useEffect(() => {
    onCroppingChange?.(Boolean(target));
  }, [target, onCroppingChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !target) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = viewW * dpr;
    canvas.height = viewH * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintCrop(
      ctx,
      target.crop.img,
      viewW,
      viewH,
      target.crop.zoom,
      target.crop.x,
      target.crop.y,
    );
  }, [target, viewW, viewH]);

  async function onPick(kind: ProductMediaKind, file: File | undefined) {
    setPickError(null);
    setCropError(null);
    if (!file) return;
    if (!isCroppableImageFile(file)) {
      setPickError(t('marketCatalog.media.notImage'));
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const img = await loadImage(dataUrl);
      setTarget({ kind, crop: { img, zoom: 1, x: 0, y: 0 } });
    } catch {
      setPickError(t('marketCatalog.media.decodeFailed'));
    }
  }

  function applyCrop() {
    if (!target) return;
    try {
      const dataUrl = exportCroppedDataUrl(
        target.crop,
        viewW,
        viewH,
        outW,
        outH,
      );
      if (target.kind === 'cover') onCoverChange?.(dataUrl);
      else onLogoChange(dataUrl);
      setTarget(null);
      setCropError(null);
    } catch {
      setCropError(t('marketCatalog.media.tooLarge'));
    }
  }

  const logoPreview = logoUrl || placeholderLogo || '';
  const coverPreview = coverUrl || placeholderCover || '';
  const logoLabel = labels?.logo ?? t('marketCatalog.create.logo');
  const logoSpec = labels?.logoSpec ?? t('marketCatalog.media.logoSpec');
  const logoEmpty = labels?.logoEmpty ?? t('marketCatalog.media.logoEmpty');
  const cropLogoTitle =
    labels?.cropLogoTitle ?? t('marketCatalog.media.cropLogoTitle');
  const hint = labels?.hint ?? t('marketCatalog.media.hint');

  if (target) {
    return (
      <div className="os-media-crop-wrap">
        <p className="os-media-crop-title">
          {target.kind === 'cover'
            ? t('marketCatalog.media.cropCoverTitle')
            : cropLogoTitle}
        </p>
        <p className="os-media-crop-hint">{t('marketCatalog.media.cropHint')}</p>
        <div
          className={`os-media-crop ${
            target.kind === 'cover'
              ? 'os-media-crop--cover'
              : 'os-media-crop--logo'
          }${
            target.kind === 'logo' && logoShape === 'round'
              ? ' os-media-crop--round'
              : ''
          }`}
          style={{
            width: `min(100%, ${viewW}px)`,
            aspectRatio: `${viewW} / ${viewH}`,
          }}
          onPointerDown={(event) => {
            dragRef.current = {
              px: event.clientX,
              py: event.clientY,
              x: target.crop.x,
              y: target.crop.y,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag) return;
            const next = clampOffset(
              target.crop.img,
              viewW,
              viewH,
              target.crop.zoom,
              drag.x + event.clientX - drag.px,
              drag.y + event.clientY - drag.py,
            );
            setTarget({
              ...target,
              crop: { ...target.crop, ...next },
            });
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
        >
          <canvas ref={canvasRef} width={viewW} height={viewH} />
        </div>
        <label className="os-media-crop-zoom" htmlFor={zoomId}>
          <span>{t('marketCatalog.media.zoom')}</span>
          <input
            id={zoomId}
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={target.crop.zoom}
            onChange={(event) => {
              const zoom = Number(event.target.value);
              const next = clampOffset(
                target.crop.img,
                viewW,
                viewH,
                zoom,
                target.crop.x,
                target.crop.y,
              );
              setTarget({
                ...target,
                crop: { ...target.crop, zoom, ...next },
              });
            }}
          />
        </label>
        <p className="os-media-crop-aspect">
          {t('marketCatalog.media.aspect')}: {viewW}:{viewH} → {outW}×{outH}
        </p>
        <div className="os-product-media__actions">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setTarget(null);
              setCropError(null);
            }}
          >
            {t('marketCatalog.cancel')}
          </Button>
          <Button type="button" size="sm" onClick={applyCrop}>
            {t('marketCatalog.media.applyCrop')}
          </Button>
        </div>
        {cropError ? <p className="os-media-crop-error">{cropError}</p> : null}
      </div>
    );
  }

  return (
    <div className="os-product-media">
      <div
        className={`os-product-media__row${
          showCover ? '' : ' os-product-media__row--logo-only'
        }`}
      >
        <div className="os-product-media__slot">
          <div className="os-product-media__label">
            <span>{logoLabel}</span>
            <span className="os-product-media__spec">{logoSpec}</span>
          </div>
          <div
            className={`os-product-media__logo-frame${
              logoShape === 'round' ? ' os-product-media__logo-frame--round' : ''
            }`}
          >
            {logoPreview ? (
              <SupplierAvatar src={logoPreview} className="size-full" />
            ) : (
              <span className="os-product-media__empty">{logoEmpty}</span>
            )}
          </div>
          {readOnly ? null : (
            <div className="os-product-media__actions">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => logoFileRef.current?.click()}
              >
                {logoUrl
                  ? t('marketCatalog.media.change')
                  : t('marketCatalog.media.upload')}
              </Button>
              {logoUrl ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onLogoChange('')}
                >
                  {t('marketCatalog.media.remove')}
                </Button>
              ) : null}
            </div>
          )}
          {readOnly ? null : (
            <input
              ref={logoFileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="os-product-media__file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                void onPick('logo', file);
              }}
            />
          )}
        </div>

        {showCover ? (
          <div className="os-product-media__slot os-product-media__slot--cover">
            <div className="os-product-media__label">
              <span>{t('marketCatalog.create.cover')}</span>
              <span className="os-product-media__spec">
                {t('marketCatalog.media.coverSpec')}
              </span>
            </div>
            <div className="os-product-media__cover-frame">
              {coverPreview ? (
                <img src={coverPreview} alt="" />
              ) : (
                <span className="os-product-media__empty">
                  {t('marketCatalog.media.coverEmpty')}
                </span>
              )}
            </div>
            <div className="os-product-media__actions">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => coverFileRef.current?.click()}
              >
                {coverUrl
                  ? t('marketCatalog.media.change')
                  : t('marketCatalog.media.upload')}
              </Button>
              {coverUrl ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onCoverChange?.('')}
                >
                  {t('marketCatalog.media.remove')}
                </Button>
              ) : null}
            </div>
            <input
              ref={coverFileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="os-product-media__file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                void onPick('cover', file);
              }}
            />
          </div>
        ) : null}
      </div>

      <p className="os-product-media__hint">{hint}</p>
      {pickError ? (
        <p className="os-product-media__error">{pickError}</p>
      ) : null}
    </div>
  );
}
