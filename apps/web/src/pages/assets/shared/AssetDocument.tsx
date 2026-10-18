import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CopyButton, ConsoleEmptyState, Skeleton, cn } from '@a3s-lab/ui';
import { OfficeMarkdownEditor, toMarkdownContent } from '@/components/OfficeMarkdownEditor';
import { IconFileText } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import { formatBytes } from '@/pages/assets/shared/format';

export type AssetFileEntry = { path: string; size: number };

const MARKDOWN = /\.(md|markdown)$/i;

export function isMarkdownPath(path: string): boolean {
  return MARKDOWN.test(path);
}

function safeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) return trimmed;
  return null;
}

function inline(source: string, key: string): ReactNode[] {
  const pattern = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\[[^\]\n]+\]\([^)\s]+\))/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let index = 0;
  for (const match of source.matchAll(pattern)) {
    const token = match[0];
    const at = match.index ?? 0;
    if (at > last) nodes.push(source.slice(last, at));
    if (token.startsWith('`')) {
      nodes.push(
        <code key={`${key}-${index}`} className="rounded bg-control-fill px-1 font-mono text-[0.92em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={`${key}-${index}`}>{token.slice(2, -2)}</strong>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      const href = link ? safeUrl(link[2]) : null;
      nodes.push(
        href && link ? (
          <a
            key={`${key}-${index}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-[color:var(--color-text-link)]"
          >
            {link[1]}
          </a>
        ) : (
          token
        ),
      );
    }
    last = at + token.length;
    index += 1;
  }
  if (last < source.length) nodes.push(source.slice(last));
  return nodes;
}

type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] };

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isRule(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

/** Readme prose. User HTML is text, and links stay on http(s) or mailto. */
export function assetMarkdownBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.startsWith('```')) {
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? '').startsWith('```')) {
        body.push(lines[index] ?? '');
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: 'code', text: body.join('\n') });
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1]!.length as 1 | 2 | 3,
        text: heading[2]!.trim(),
      });
      index += 1;
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (index < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[index] ?? '')) {
        items.push((lines[index] ?? '').replace(/^\s*([-*]|\d+\.)\s+/, ''));
        index += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    if (line.trim().startsWith('|') && (lines[index + 1] ?? '').includes('-')) {
      const headers = cells(line);
      index += 1;
      if (isRule(lines[index] ?? '')) index += 1;
      const rows: string[][] = [];
      while (index < lines.length && (lines[index] ?? '').trim().startsWith('|')) {
        rows.push(cells(lines[index] ?? ''));
        index += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }
    const paragraph: string[] = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      (lines[index] ?? '').trim() &&
      !/^(#{1,3})\s+/.test(lines[index] ?? '') &&
      !(lines[index] ?? '').startsWith('```') &&
      !/^\s*([-*]|\d+\.)\s+/.test(lines[index] ?? '') &&
      !(lines[index] ?? '').trim().startsWith('|')
    ) {
      paragraph.push((lines[index] ?? '').trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }
  return blocks;
}

export function AssetMarkdown({ markdown }: { markdown: string }) {
  const { t } = useI18n();
  const blocks = assetMarkdownBlocks(markdown);
  if (blocks.length === 0) {
    return <ConsoleEmptyState plain title={t('assets.readme.empty')} />;
  }
  return (
    <div className="space-y-3 text-sm leading-6 text-ink">
      {blocks.map((block, index) => {
        const key = `b${index}`;
        if (block.type === 'heading') {
          const className =
            block.level === 1
              ? 'text-base font-medium'
              : 'text-sm font-medium';
          return (
            <h3 key={key} className={className}>
              {inline(block.text, key)}
            </h3>
          );
        }
        if (block.type === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul';
          return (
            <Tag
              key={key}
              className={block.ordered ? 'list-decimal space-y-1 pl-5' : 'list-disc space-y-1 pl-5'}
            >
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>{inline(item, `${key}-${itemIndex}`)}</li>
              ))}
            </Tag>
          );
        }
        if (block.type === 'code') {
          return <AssetSourceLines key={key} text={block.text} />;
        }
        if (block.type === 'table') {
          return (
            <div key={key} className="overflow-auto rounded-xl bg-surface shadow-[inset_0_0_0_1px_var(--color-hairline)]">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr>
                    {block.headers.map((header) => (
                      <th
                        key={header}
                        className="border-b border-[color:var(--color-hairline)] px-3 py-2 text-xs font-medium text-ink-muted"
                      >
                        {inline(header, `${key}-${header}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={`${key}-r${rowIndex}`}>
                      {block.headers.map((_, cellIndex) => (
                        <td
                          key={`${key}-${rowIndex}-${cellIndex}`}
                          className="border-b border-[color:var(--color-hairline)] px-3 py-2"
                        >
                          {inline(row[cellIndex] ?? '', `${key}-${rowIndex}-${cellIndex}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return <p key={key}>{inline(block.text, key)}</p>;
      })}
    </div>
  );
}

function AssetSourceLines({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="overflow-auto bg-surface">
      <div className="min-w-full py-2 font-mono text-[13px] leading-5">
        {lines.map((line, index) => (
          <div key={index} className="grid grid-cols-[2.75rem_minmax(0,1fr)]">
            <span className="select-none pr-3 text-right text-ink-faint tabular-nums">
              {index + 1}
            </span>
            <span className="whitespace-pre pr-4 text-ink">{line || ' '}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type AssetTreeDir = { kind: 'dir'; name: string; path: string; children: AssetTreeNode[] };
type AssetTreeFile = { kind: 'file'; name: string; path: string; size: number };
export type AssetTreeNode = AssetTreeDir | AssetTreeFile;

/** Group package paths into directories. Folders sort ahead of files at each level. */
export function assetFileTree(files: AssetFileEntry[]): AssetTreeNode[] {
  const roots: AssetTreeNode[] = [];
  const dirs = new Map<string, AssetTreeDir>();
  const place = (parentPath: string): AssetTreeNode[] => {
    if (!parentPath) return roots;
    const found = dirs.get(parentPath);
    if (!found) return roots;
    return found.children;
  };
  for (const file of files) {
    const parts = file.path.split('/').filter((part) => part.length > 0);
    if (parts.length === 0) continue;
    let parentPath = '';
    for (let index = 0; index < parts.length - 1; index += 1) {
      const name = parts[index] ?? '';
      const path = parentPath ? `${parentPath}/${name}` : name;
      if (!dirs.has(path)) {
        const dir: AssetTreeDir = { kind: 'dir', name, path, children: [] };
        dirs.set(path, dir);
        place(parentPath).push(dir);
      }
      parentPath = path;
    }
    const name = parts[parts.length - 1] ?? file.path;
    place(parentPath).push({ kind: 'file', name, path: file.path, size: file.size });
  }
  const sortNodes = (nodes: AssetTreeNode[]) => {
    nodes.sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === 'dir' ? -1 : 1;
      return left.name.localeCompare(right.name, undefined, { numeric: true });
    });
    for (const node of nodes) {
      if (node.kind === 'dir') sortNodes(node.children);
    }
  };
  sortNodes(roots);
  return roots;
}

export type AssetDirEntry =
  | { kind: 'dir'; name: string; path: string }
  | { kind: 'file'; name: string; path: string; size: number };

/** One directory, the way a repository file list shows the current folder. */
export function assetDirectory(files: AssetFileEntry[], directory: string): AssetDirEntry[] {
  const prefix = directory ? `${directory}/` : '';
  const dirs = new Map<string, AssetDirEntry>();
  const listed: AssetDirEntry[] = [];
  for (const file of files) {
    if (prefix && !file.path.startsWith(prefix)) continue;
    const rest = prefix ? file.path.slice(prefix.length) : file.path;
    if (!rest) continue;
    const slash = rest.indexOf('/');
    if (slash === -1) {
      listed.push({ kind: 'file', name: rest, path: file.path, size: file.size });
      continue;
    }
    const name = rest.slice(0, slash);
    const path = prefix ? `${directory}/${name}` : name;
    if (!dirs.has(path)) dirs.set(path, { kind: 'dir', name, path });
  }
  const byName = (left: { name: string }, right: { name: string }) =>
    left.name.localeCompare(right.name, undefined, { numeric: true });
  return [...dirs.values()].sort(byName).concat(listed.sort(byName));
}

const BINARY_FILE =
  /\.(safetensors|bin|onnx|ot|gguf|pt|pth|ckpt|msgpack|parquet|arrow|npz|npy|tflite|ort|wasm|png|jpe?g|gif|webp|ico|pdf|zip|tar|gz|bz2|xz|7z|model)$/i;

/** Page preview stays on small text. Weights and archives stay a download. */
export function canPreviewAssetFile(path: string, size: number): boolean {
  if (size > 256 * 1024) return false;
  if (path.endsWith('tokenizer.model')) return false;
  return !BINARY_FILE.test(path);
}

function parentDirectory(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

function FolderMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0 text-ink-faint"
    >
      <path d="M3.5 8.5h5.2l1.8 2H20.5V19a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 19V8.5Z" />
      <path d="M3.5 8.5V6.5A1.5 1.5 0 0 1 5 5h4l1.6 1.8" />
    </svg>
  );
}

/** Line-numbered source for JSON and other non-markdown files. */
export function AssetFileView({
  path,
  text,
  fill = false,
  chrome = true,
}: {
  path: string;
  text: string;
  fill?: boolean;
  /** Path bar and copy control. A repository header already shows both. */
  chrome?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className={cn('min-w-0 overflow-hidden bg-surface', fill && 'flex h-full min-h-0 flex-col')}>
      {chrome ? (
        <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-[color:var(--color-hairline)] px-3">
          <span className="truncate font-mono text-xs text-ink">{path}</span>
          <CopyButton
            value={text}
            label={t('assets.doc.copy')}
            className="!h-7"
          />
        </div>
      ) : null}
      <div className={fill ? 'min-h-0 flex-1 overflow-auto' : 'max-h-[70vh] overflow-auto'}>
        <AssetSourceLines text={text} />
      </div>
    </div>
  );
}

function RepoCrumbs({
  rootLabel,
  directory,
  fileName,
  onDirectory,
}: {
  rootLabel: string;
  directory: string;
  fileName: string;
  onDirectory: (path: string) => void;
}) {
  const parts = directory.split('/').filter((part) => part.length > 0);
  return (
    <nav aria-label={rootLabel} className="flex min-w-0 flex-1 items-center gap-1 text-[13px]">
      <button
        type="button"
        onClick={() => onDirectory('')}
        className="shrink-0 text-ink hover:underline"
      >
        {rootLabel}
      </button>
      {parts.map((part, index) => {
        const path = parts.slice(0, index + 1).join('/');
        return (
          <span key={path} className="flex min-w-0 items-center gap-1">
            <span className="text-ink-faint">/</span>
            <button type="button" onClick={() => onDirectory(path)} className="truncate text-ink hover:underline">
              {part}
            </button>
          </span>
        );
      })}
      {fileName ? (
        <span className="flex min-w-0 items-center gap-1">
          <span className="text-ink-faint">/</span>
          <span className="truncate font-medium text-ink">{fileName}</span>
        </span>
      ) : null}
    </nav>
  );
}

/**
 * Repository file list: the current directory is a table, a folder opens that
 * directory, and a file opens its own page with a breadcrumb back.
 */
export function AssetFileBrowser({
  files,
  rootLabel,
  selected,
  onSelect,
  loading,
  text,
  error,
  emptyLabel,
  annotate,
  rowActions,
  fileActions,
}: {
  files: AssetFileEntry[];
  rootLabel?: string;
  selected: string;
  onSelect: (path: string) => void;
  loading: boolean;
  text?: string | null;
  error?: string | null;
  emptyLabel: string;
  annotate?: (path: string) => ReactNode;
  rowActions?: (file: AssetFileEntry) => ReactNode;
  fileActions?: ReactNode;
}) {
  const { t } = useI18n();
  const [directory, setDirectory] = useState('');
  const [mode, setMode] = useState<'preview' | 'code'>('preview');
  const open = files.some((file) => file.path === selected) ? selected : '';
  const folder = open ? parentDirectory(open) : directory;
  const entries = useMemo(() => assetDirectory(files, folder), [files, folder]);
  const markdown = text != null && !text.includes('\0') && isMarkdownPath(open);
  const source = text != null && !text.includes('\0') ? text : null;
  const markdownContent = useMemo(
    () => (markdown && source != null ? toMarkdownContent(source) : null),
    [markdown, source],
  );
  useEffect(() => {
    setMode('preview');
  }, [open]);

  const goToDirectory = (path: string) => {
    setDirectory(path);
    if (open) onSelect('');
  };
  const fileName = open ? (open.split('/').pop() ?? open) : '';
  const openFile = open ? files.find((file) => file.path === open) : undefined;
  const label = rootLabel || t('assets.files.root');

  return (
    <div className="overflow-hidden rounded-xl bg-surface shadow-[inset_0_0_0_1px_var(--color-hairline)]">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-[color:var(--color-hairline)] bg-[var(--spec-quiet-button-hover)] px-3 py-1.5">
        <RepoCrumbs rootLabel={label} directory={folder} fileName={fileName} onDirectory={goToDirectory} />
        {open ? (
          <div className="flex shrink-0 items-center gap-1">
            {openFile ? (
              <span className="mr-1 text-[12px] tabular-nums text-ink-faint">{formatBytes(openFile.size)}</span>
            ) : null}
            {markdown && source != null ? (
              <div className="mr-1 flex items-center gap-1 text-[13px]">
                <button
                  type="button"
                  aria-pressed={mode === 'preview'}
                  onClick={() => setMode('preview')}
                  className={cn('rounded px-1.5 py-0.5', mode === 'preview' ? 'font-medium text-ink' : 'text-ink-muted')}
                >
                  {t('assets.files.preview')}
                </button>
                <button
                  type="button"
                  aria-pressed={mode === 'code'}
                  onClick={() => setMode('code')}
                  className={cn('rounded px-1.5 py-0.5', mode === 'code' ? 'font-medium text-ink' : 'text-ink-muted')}
                >
                  {t('assets.files.code')}
                </button>
              </div>
            ) : null}
            {source != null ? (
              <CopyButton value={source} label={t('assets.doc.copy')} className="!h-7" />
            ) : null}
            {fileActions}
          </div>
        ) : (
          <span className="shrink-0 text-[12px] tabular-nums text-ink-faint">
            {t('assets.files.count').replace('{count}', String(entries.length))}
          </span>
        )}
      </div>
      {open ? (
        loading ? (
          <Skeleton className="h-64" />
        ) : mode === 'preview' && markdownContent ? (
          <OfficeMarkdownEditor
            key={open}
            preview
            content={markdownContent}
            onChange={() => undefined}
            className="min-h-[360px]"
          />
        ) : source != null ? (
          <AssetFileView chrome={false} key={open} path={open} text={source} />
        ) : (
          <ConsoleEmptyState plain title={error || emptyLabel} />
        )
      ) : entries.length === 0 ? (
        <ConsoleEmptyState plain title={emptyLabel} />
      ) : (
        <div>
          <div className="flex h-9 items-center border-b border-[color:var(--color-hairline)] text-[12px] text-ink-muted">
            <div className="flex min-w-0 flex-1 items-center px-3">
              <span className="min-w-0 flex-1">{t('assets.field.name')}</span>
              <span className="w-24 shrink-0 text-right">{t('assets.stat.size')}</span>
            </div>
            {rowActions ? <div className="w-[4.5rem] shrink-0" /> : null}
          </div>
          <ul>
            {entries.map((entry) => {
              const file = entry.kind === 'file' ? files.find((item) => item.path === entry.path) : undefined;
              return (
                <li
                  key={entry.path}
                  className="flex items-center border-b border-[color:var(--color-hairline)] last:border-b-0 hover:bg-[var(--spec-hover-row)]"
                >
                  <button
                    type="button"
                    onClick={() => (entry.kind === 'dir' ? goToDirectory(entry.path) : onSelect(entry.path))}
                    className="flex h-10 min-w-0 flex-1 items-center gap-2 px-3 text-left"
                  >
                    {entry.kind === 'dir' ? (
                      <FolderMark />
                    ) : (
                      <IconFileText width={14} height={14} className="shrink-0 text-ink-faint" />
                    )}
                    <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink">{entry.name}</span>
                    {entry.kind === 'file' && annotate ? <span className="shrink-0">{annotate(entry.path)}</span> : null}
                    <span className="w-24 shrink-0 text-right text-[12px] tabular-nums text-ink-faint">
                      {entry.kind === 'file' ? formatBytes(entry.size) : ''}
                    </span>
                  </button>
                  {rowActions ? (
                    <div className="flex w-[4.5rem] shrink-0 items-center justify-end pr-1">
                      {file ? rowActions(file) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
