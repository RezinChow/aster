import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from "react";
import { navigate } from "../router";

type Href = string | { pathname?: string; query?: Record<string, string> };
type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: Href;
  replace?: boolean;
  prefetch?: boolean | null;
  scroll?: boolean;
  shallow?: boolean;
  passHref?: boolean;
  legacyBehavior?: boolean;
};

function hrefOf(href: Href): string {
  if (typeof href === "string") return href;
  const query = new URLSearchParams(href.query ?? {}).toString();
  return (href.pathname ?? "") + (query ? `?${query}` : "");
}

const Link = forwardRef<HTMLAnchorElement, Props>(function Link(
  { href, replace, prefetch, scroll, shallow, passHref, legacyBehavior, onClick, ...rest },
  ref,
) {
  const target = hrefOf(href);
  const external = /^[a-z][a-z0-9+.-]*:/i.test(target);
  return (
    <a
      ref={ref}
      {...rest}
      href={external ? target : "#"}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (external || event.defaultPrevented) return;
        event.preventDefault();
        navigate(target, replace ? "replace" : "push");
      }}
    />
  );
});

export default Link;
