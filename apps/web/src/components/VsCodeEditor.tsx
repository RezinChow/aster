import Editor, { type OnMount } from '@monaco-editor/react';
import { Card, cn } from '@a3s-lab/ui';

const LANGUAGE_BY_EXT: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'markdown',
  py: 'python',
  rs: 'rust',
  go: 'go',
  css: 'css',
  html: 'html',
  sh: 'shell',
  toml: 'ini',
};

export function languageFromPath(path: string, fallback = 'plaintext'): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return LANGUAGE_BY_EXT[ext] ?? fallback;
}

export function VsCodeEditor({
  path,
  language,
  value,
  onChange,
  className,
  readOnly = false,
  showPath = true,
}: {
  path?: string;
  language?: string;
  value: string;
  onChange?: (value: string) => void;
  className?: string;
  readOnly?: boolean;
  /** Show Monaco chrome path bar (default true). */
  showPath?: boolean;
}) {
  const lang = language || (path ? languageFromPath(path) : 'plaintext');

  const handleMount: OnMount = (editor, monaco) => {
    monaco.editor.defineTheme('a3s-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#f8f8f9',
        'editor.lineHighlightBackground': '#eceef180',
        'editorLineNumber.foreground': '#9ca3af',
        'editorGutter.background': '#f3f4f6',
        'editorCursor.foreground': '#171717',
      },
    });
    monaco.editor.setTheme('a3s-light');
    editor.updateOptions({
      fontFamily:
        'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 13,
      lineHeight: 20,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      renderLineHighlight: readOnly ? 'none' : 'line',
      padding: { top: 8, bottom: 8 },
      tabSize: 2,
      automaticLayout: true,
      readOnly,
      // Keep Monaco caret; avoid native readonly textarea which can hide it.
      domReadOnly: false,
      cursorStyle: 'line',
      cursorBlinking: 'blink',
      cursorWidth: 2,
    });
  };

  return (
    <Card
      className={cn(
        'h-[min(72dvh,720px)] min-h-[420px] overflow-hidden',
        className,
      )}
    >
      {showPath && path ? (
        <div className="flex h-8 items-center border-b-0 bg-surface px-3 font-mono text-[12px] text-ink-muted">
          {path}
        </div>
      ) : null}
      <div
        className={cn(
          'min-h-0',
          showPath && path ? 'h-[calc(100%-2rem)]' : 'h-full',
        )}
      >
        <Editor
          language={lang}
          value={value}
          path={path}
          onChange={(next) => onChange?.(next ?? '')}
          onMount={handleMount}
          options={{
            readOnly,
            domReadOnly: false,
            cursorStyle: 'line',
            cursorBlinking: 'blink',
            cursorWidth: 2,
            wordWrap: 'on',
            scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
          }}
          loading={
            <div className="flex h-full items-center justify-center text-sm text-ink-faint">
              Loading editor…
            </div>
          }
        />
      </div>
    </Card>
  );
}
