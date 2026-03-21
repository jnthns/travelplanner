import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({
  breaks: true,
  gfm: true,
});

interface MarkdownProps {
  children: string;
  className?: string;
}

const Markdown: React.FC<MarkdownProps> = ({ children, className }) => {
  const html = useMemo(() => {
    const result = marked.parse(children);
    const raw = typeof result === 'string' ? result : '';
    return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
  }, [children]);

  return (
    <div
      className={`markdown-content ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default Markdown;
