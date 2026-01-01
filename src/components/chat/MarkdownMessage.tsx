"use client";

import { Streamdown } from "streamdown";

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

export function MarkdownMessage({ content, className = "" }: MarkdownMessageProps) {
  return (
    <div className={`text-sm md:text-base ${className}`}>
      <Streamdown>{content}</Streamdown>
    </div>
  );
}
