export function PartnerLogo({
  name,
  logoUrl,
  size = 'sm',
}: {
  name: string;
  logoUrl: string;
  size?: 'sm' | 'md';
}) {
  const box = size === 'md' ? 'h-12 w-12 text-base' : 'h-8 w-8 text-[11px]';
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={`${box} shrink-0 rounded-md object-cover`}
      />
    );
  }
  const mark = [...name.trim()][0] || '·';
  return (
    <span
      className={`${box} inline-flex shrink-0 items-center justify-center rounded-md bg-ink font-medium text-[color:var(--color-bg)]`}
      aria-hidden
    >
      {mark}
    </span>
  );
}
