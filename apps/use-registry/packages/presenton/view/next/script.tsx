// Only Smart mode's Tailwind runtime loads a script through next/script; the
// view runs Standard mode and loads no scripts this way.
export default function Script(): null {
  return null;
}
