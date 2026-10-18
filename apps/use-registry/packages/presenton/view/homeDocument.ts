// The view document's bridge startup. The homepage seed is applied here,
// after stored state is restored, on the port Studio handed this document.
import { homeDocumentRestored, connect, connected } from "./host";
import { location, navigate, onLocationChange, restore as restoreRoute } from "./router";
import { deck, restore, save } from "./backend/state";
import "./backend/homeSeed";
import "./backend/deckControl";

// An empty deck on the presentation page gets a blank slide. No stream param: opening the editor must not regenerate.
export function openWorkspaceSurface() {
  if (location().pathname !== "/upload" || !deck?.id) return;
  const id = encodeURIComponent(deck.id);
  navigate(deck.slides.length > 0 ? `/presentation?id=${id}` : `/outline?id=${id}`, "replace");
}

export async function startHomeDocument(): Promise<boolean> {
  const stateJSON = await connect();
  const route = await restore(stateJSON);
  if (route) restoreRoute(route);
  onLocationChange(save);
  onLocationChange(openWorkspaceSurface);
  homeDocumentRestored();
  openWorkspaceSurface();
  return connected();
}
