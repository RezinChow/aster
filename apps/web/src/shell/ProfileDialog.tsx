import { useEffect, useId, useRef, useState } from 'react';
import { Button, ConsoleDialog, ConsoleFormField, Input, useToast } from '@a3s-lab/ui';
import { useI18n } from '@/i18n/useI18n';
import { BrandMark } from './BrandMark';
import {
  PROFILE_NAME_MAX,
  setProfile,
  useProfile,
} from './profileStore';

const VIEW = 240;
const OUT = 256;
const MAX_BYTES = 450_000;

type Crop = {
  img: HTMLImageElement;
  zoom: number;
  x: number;
  y: number;
};

function coverScale(img: HTMLImageElement, view: number) {
  return Math.max(view / img.width, view / img.height);
}

function clampOffset(
  img: HTMLImageElement,
  view: number,
  zoom: number,
  x: number,
  y: number,
) {
  const scale = coverScale(img, view) * zoom;
  const maxX = Math.max(0, (img.width * scale - view) / 2);
  const maxY = Math.max(0, (img.height * scale - view) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, x)),
    y: Math.min(maxY, Math.max(-maxY, y)),
  };
}

function paint(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  view: number,
  zoom: number,
  x: number,
  y: number,
) {
  const offset = clampOffset(img, view, zoom, x, y);
  const scale = coverScale(img, view) * zoom;
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.clearRect(0, 0, view, view);
  ctx.drawImage(img, (view - dw) / 2 + offset.x, (view - dh) / 2 + offset.y, dw, dh);
}

function exportAvatar(crop: Crop) {
  const canvas = document.createElement('canvas');
  canvas.width = OUT;
  canvas.height = OUT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  const ratio = OUT / VIEW;
  ctx.scale(ratio, ratio);
  paint(ctx, crop.img, VIEW, crop.zoom, crop.x, crop.y);
  let quality = 0.92;
  let out = canvas.toDataURL('image/jpeg', quality);
  while (out.length > MAX_BYTES && quality > 0.5) {
    quality -= 0.08;
    out = canvas.toDataURL('image/jpeg', quality);
  }
  if (out.length > MAX_BYTES) throw new Error('too-large');
  return out;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode'));
    img.src = src;
  });
}

export function ProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const profile = useProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ px: number; py: number; x: number; y: number } | null>(
    null,
  );
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [error, setError] = useState<string | null>(null);
  const zoomId = useId();

  useEffect(() => {
    if (!open) return;
    setName(profile.name);
    setAvatar(profile.avatarDataUrl);
    setCrop(null);
    setError(null);
  }, [open, profile.name, profile.avatarDataUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !crop) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = VIEW * dpr;
    canvas.height = VIEW * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(ctx, crop.img, VIEW, crop.zoom, crop.x, crop.y);
  }, [crop]);

  async function onPick(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      setError(t('shell.profile.notImage'));
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('decode'));
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.readAsDataURL(file);
      });
      const img = await loadImage(dataUrl);
      setCrop({ img, zoom: 1, x: 0, y: 0 });
    } catch {
      setError(t('shell.profile.decodeFailed'));
    }
  }

  function applyCrop() {
    if (!crop) return;
    try {
      setAvatar(exportAvatar(crop));
      setCrop(null);
      setError(null);
    } catch {
      setError(t('shell.profile.tooLarge'));
    }
  }

  function save() {
    setProfile(name, avatar);
    onOpenChange(false);
    toast.push({
      tone: 'success',
      title: t('shell.profile.saved'),
    });
  }

  const cropping = Boolean(crop);

  return (
    <ConsoleDialog
      open={open}
      onOpenChange={onOpenChange}
      title={cropping ? t('shell.profile.cropTitle') : t('shell.profile.title')}
      description={
        cropping ? t('shell.profile.cropHint') : t('shell.profile.hint')
      }
      size="sm"
      footer={
        cropping ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setCrop(null)}
            >
              {t('shell.profile.back')}
            </Button>
            <Button type="button" size="sm" onClick={applyCrop}>
              {t('shell.profile.usePhoto')}
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('identity.cancel')}
            </Button>
            <Button type="button" size="sm" onClick={save}>
              {t('shell.profile.save')}
            </Button>
          </>
        )
      }
    >
      {crop ? (
        <div className="os-profile-crop-wrap">
          <div
            className="os-profile-crop"
            onPointerDown={(event) => {
              dragRef.current = {
                px: event.clientX,
                py: event.clientY,
                x: crop.x,
                y: crop.y,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              if (!drag) return;
              const next = clampOffset(
                crop.img,
                VIEW,
                crop.zoom,
                drag.x + event.clientX - drag.px,
                drag.y + event.clientY - drag.py,
              );
              setCrop({ ...crop, ...next });
            }}
            onPointerUp={() => {
              dragRef.current = null;
            }}
          >
            <canvas ref={canvasRef} width={VIEW} height={VIEW} />
          </div>
          <label className="os-profile-zoom" htmlFor={zoomId}>
            <span>{t('shell.profile.zoom')}</span>
            <input
              id={zoomId}
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={crop.zoom}
              onChange={(event) => {
                const zoom = Number(event.target.value);
                const next = clampOffset(crop.img, VIEW, zoom, crop.x, crop.y);
                setCrop({ ...crop, zoom, ...next });
              }}
            />
          </label>
        </div>
      ) : (
        <div className="os-profile-form">
          <div className="os-profile-avatar-row">
            <span className="os-profile-avatar" aria-hidden>
              {avatar ? (
                <img src={avatar} alt="" />
              ) : (
                <BrandMark size={36} alt="" />
              )}
            </span>
            <div className="os-profile-avatar-actions">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
              >
                {t('shell.profile.changePhoto')}
              </Button>
              {avatar ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setAvatar(null)}
                >
                  {t('shell.profile.removePhoto')}
                </Button>
              ) : null}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="os-profile-file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                void onPick(file);
              }}
            />
          </div>
          <ConsoleFormField label={t('shell.profile.name')}>
            <Input
              value={name}
              maxLength={PROFILE_NAME_MAX}
              placeholder={t('shell.profile.namePlaceholder')}
              onChange={(event) => setName(event.target.value)}
            />
          </ConsoleFormField>
        </div>
      )}
      {error ? <p className="os-profile-error">{error}</p> : null}
    </ConsoleDialog>
  );
}
