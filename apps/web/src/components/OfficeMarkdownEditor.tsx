import { MarkdownEditor, type OfficeTheme } from '@a3s-lab/office/react';
import type { MarkdownContent } from '@a3s-lab/office/core';
import '@a3s-lab/office/styles.css';
import { Card, cn } from '@a3s-lab/ui';

export function toMarkdownContent(markdown: string): MarkdownContent {
  return { type: 'markdown', markdown };
}

export function OfficeMarkdownEditor({
  content,
  onChange,
  className,
  preview = false,
  fill = false,
  saveStatus,
  theme = 'system',
}: {
  content: MarkdownContent;
  onChange: (content: MarkdownContent) => void;
  className?: string;
  preview?: boolean;
  /** 铺满父级，不套卡片、不锁高度。父级已经是卡片时用这个。 */
  fill?: boolean;
  saveStatus?: string;
  theme?: OfficeTheme;
}) {
  const editor = (
    <MarkdownEditor
      content={content}
      onChange={onChange}
      theme={theme}
      preview={preview}
      saveStatus={saveStatus}
      className={fill ? className : undefined}
      style={{ height: '100%', minHeight: 0 }}
    />
  );
  if (fill) return editor;
  return (
    <Card
      className={cn(
        'h-[min(72dvh,720px)] min-h-[420px] overflow-hidden',
        className,
      )}
    >
      {editor}
    </Card>
  );
}
