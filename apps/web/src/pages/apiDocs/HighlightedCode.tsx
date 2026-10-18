import { useMemo } from 'react';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import csharp from 'highlight.js/lib/languages/csharp';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import php from 'highlight.js/lib/languages/php';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';

let registered = false;

function ensureLanguages() {
  if (registered) return;
  hljs.registerLanguage('bash', bash);
  hljs.registerLanguage('csharp', csharp);
  hljs.registerLanguage('go', go);
  hljs.registerLanguage('java', java);
  hljs.registerLanguage('javascript', javascript);
  hljs.registerLanguage('json', json);
  hljs.registerLanguage('php', php);
  hljs.registerLanguage('python', python);
  hljs.registerLanguage('ruby', ruby);
  hljs.registerLanguage('rust', rust);
  registered = true;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function HighlightedCode({
  code,
  language,
  className,
}: {
  code: string;
  language: string;
  className?: string;
}) {
  const html = useMemo(() => {
    if (!code) return '';
    if (language === 'plaintext' || language === 'text') {
      return escapeHtml(code);
    }
    ensureLanguages();
    try {
      return hljs.highlight(code, { language }).value;
    } catch {
      return escapeHtml(code);
    }
  }, [code, language]);

  return (
    <pre className={className ? `api-docs__code ${className}` : 'api-docs__code'}>
      <code
        className={`hljs language-${language}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </pre>
  );
}
