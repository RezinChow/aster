import { forwardRef, type CSSProperties, type ImgHTMLAttributes } from "react";
import { assetUrl } from "./asset";

type StaticImport = { src: string; width?: number; height?: number };
type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | StaticImport;
  fill?: boolean;
  priority?: boolean;
  quality?: number | string;
  placeholder?: string;
  blurDataURL?: string;
  unoptimized?: boolean;
  loader?: unknown;
  overrideSrc?: string;
  onLoadingComplete?: (image: HTMLImageElement) => void;
};

const FILL: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" };

const Image = forwardRef<HTMLImageElement, Props>(function Image(
  { src, fill, priority, quality, placeholder, blurDataURL, unoptimized, loader, overrideSrc, onLoadingComplete, style, onLoad, ...rest },
  ref,
) {
  const url = typeof src === "string" ? src : src.src;
  return (
    <img
      ref={ref}
      {...rest}
      src={assetUrl(url)}
      loading={priority ? "eager" : rest.loading}
      style={fill ? { ...FILL, ...style } : style}
      onLoad={(event) => {
        onLoad?.(event);
        onLoadingComplete?.(event.currentTarget);
      }}
    />
  );
});

export default Image;
