import { Check, Copy } from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export interface CodeBlockProps {
  code: string
  language?: string
  filename?: string
  showLineNumbers?: boolean
  highlightLines?: number[]
  wrap?: boolean
  maxHeight?: number | string
  copyable?: boolean
  onCopy?: (code: string) => void
  className?: string
  style?: CSSProperties
}

const TOKEN = /(\/\/[^\n]*|#[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b(?:const|let|var|function|return|import|export|from|if|else|for|while|new|class|interface|type|async|await|def|print|true|false|null|undefined)\b)/g
const KEYWORDS = /^(?:const|let|var|function|return|import|export|from|if|else|for|while|new|class|interface|type|async|await|def|print|true|false|null|undefined)$/
const COLORED = /^(ts|tsx|js|jsx|json|bash|sh|python)$/i

function colorize(line: string, language?: string): ReactNode {
  if (!line) return '\u00a0'
  if (!COLORED.test(language ?? '')) return line
  return line.split(TOKEN).map((token, index) => {
    if (!token) return null
    if (token.startsWith('//') || (/^#/.test(token) && /^(bash|sh|python)$/i.test(language ?? ''))) {
      return <span key={index} className="text-muted-foreground">{token}</span>
    }
    if (/^["'`]/.test(token)) {
      return <span key={index} className="text-success-subtle-foreground">{token}</span>
    }
    if (KEYWORDS.test(token)) {
      return <span key={index} className="text-info">{token}</span>
    }
    return token
  })
}

/** Code to read and copy, with line numbers, highlighted lines and a tiny colorizer. */
export function CodeBlock({
  code,
  language,
  filename,
  showLineNumbers = false,
  highlightLines,
  wrap = false,
  maxHeight,
  copyable = true,
  onCopy,
  className,
  style
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const lines = code.replace(/\n$/, '').split('\n')
  const highlighted = new Set(highlightLines ?? [])
  const label = filename ?? language

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(code)
    } catch {
      // Clipboard may be blocked; still notify the consumer.
    }
    setCopied(true)
    onCopy?.(code)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <figure
      data-slot="code-block"
      className={cn('m-0 w-full max-w-full overflow-hidden rounded-lg border border-border bg-card', className)}
      style={style}
    >
      {label || copyable ? (
        <figcaption className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-1.5">
          <span className="truncate text-[11px] text-muted-foreground" title={filename}>
            {label}
          </span>
          {copyable ? (
            <button
              type="button"
              aria-label={copied ? 'Copied' : 'Copy code'}
              title={copied ? 'Copied' : 'Copy code'}
              onClick={copy}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {copied ? <Check aria-hidden="true" className="size-3.5" /> : <Copy aria-hidden="true" className="size-3.5" />}
            </button>
          ) : null}
        </figcaption>
      ) : null}
      <div
        className={cn('overflow-auto', maxHeight !== undefined && 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring')}
        style={{ maxHeight }}
        tabIndex={maxHeight !== undefined ? 0 : undefined}
      >
        <pre
          dir="ltr"
          className={cn('m-0 p-3 text-xs leading-5 text-foreground', wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre')}
        >
          <code>
            {lines.map((line, index) => (
              <span
                key={index}
                className={cn(
                  'block rounded-sm',
                  highlighted.has(index + 1) && 'bg-info-subtle pl-1 -ml-1 border-l-2 border-info'
                )}
              >
                {showLineNumbers ? (
                  <span aria-hidden="true" className="mr-3 inline-block w-5 shrink-0 select-none text-right text-muted-foreground">
                    {index + 1}
                  </span>
                ) : null}
                {colorize(line, language)}
              </span>
            ))}
          </code>
        </pre>
      </div>
      <span role="status" className="sr-only">{copied ? 'Copied' : ''}</span>
    </figure>
  )
}
