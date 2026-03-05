import React, { useMemo } from 'react';
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
    return typeof result === 'string' ? result : '';
  }, [children]);

  return (
    <div
      className={`markdown-content ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default Markdown;
