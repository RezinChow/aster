import { Badge, cn } from '@a3s-lab/ui';

const METHOD_CLASS: Record<string, string> = {
  GET: '!border-transparent !bg-[color:color-mix(in_srgb,#2563eb_16%,transparent)] !text-[#1d4ed8]',
  POST: '!border-transparent !bg-[color:color-mix(in_srgb,#16a34a_16%,transparent)] !text-[#15803d]',
  PUT: '!border-transparent !bg-[color:color-mix(in_srgb,#d97706_16%,transparent)] !text-[#b45309]',
  PATCH:
    '!border-transparent !bg-[color:color-mix(in_srgb,#7c3aed_16%,transparent)] !text-[#6d28d9]',
  DELETE:
    '!border-transparent !bg-[color:color-mix(in_srgb,#dc2626_16%,transparent)] !text-[#b91c1c]',
  HEAD: '!border-transparent !bg-[color:color-mix(in_srgb,#0891b2_16%,transparent)] !text-[#0e7490]',
  OPTIONS:
    '!border-transparent !bg-[color:color-mix(in_srgb,#64748b_16%,transparent)] !text-[#475569]',
};

/** HTTP method chip with conventional OpenAPI-ish colors. */
export function HttpMethodBadge({
  method,
  className = '',
}: {
  method: string;
  className?: string;
}) {
  const m = method.trim().toUpperCase() || 'GET';
  return (
    <Badge
      tone="neutral"
      className={cn('!rounded-sm !tracking-[0.04em]', METHOD_CLASS[m], className)}
    >
      {m}
    </Badge>
  );
}
