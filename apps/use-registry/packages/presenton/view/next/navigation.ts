import { useMemo, useSyncExternalStore } from "react";
import { goBack, location, navigate, subscribe } from "../router";

const router = {
  push: (href: string) => navigate(href, "push"),
  replace: (href: string) => navigate(href, "replace"),
  back: goBack,
  forward: () => {},
  refresh: () => {},
  prefetch: () => {},
};

function useLocation() {
  return useSyncExternalStore(subscribe, location);
}

export function useRouter() {
  return router;
}

export function usePathname() {
  return useLocation().pathname;
}

export function useSearchParams() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function useParams() {
  return {};
}

export function redirect(href: string): never {
  navigate(href, "replace");
  throw new Error(`redirected to ${href}`);
}

export function notFound(): never {
  throw new Error("not found");
}
