import React, { useRef, useEffect, useCallback } from 'react';

interface AutoTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minRows?: number;
}

const AutoTextarea: React.FC<AutoTextareaProps> = ({ minRows = 2, value, onChange, ...rest }) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      rows={minRows}
      {...rest}
      style={{ ...rest.style, overflow: 'hidden', resize: 'none' }}
    />
  );
};

export default AutoTextarea;
