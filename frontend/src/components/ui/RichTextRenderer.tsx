'use client';

import React from 'react';

interface RichTextRendererProps {
  content: string;
  className?: string;
  lineClamp?: number;
  highlightMentionsAndTags?: boolean;
}

// Helper to parse inline styles: bold (**text**), italic (*text*), strike (~~text~~), hashtags, mentions, and URLs
function parseInlineFormatting(line: string, highlight: boolean): React.ReactNode[] {
  // Regex tokenizes:
  // 1. URLs
  // 2. Bold: \*\*(.+?)\*\*
  // 3. Italic: \*([^*]+?)\*
  // 4. Strikethrough: ~~(.+?)~~
  // 5. Hashtags: #([\w\u00C0-\u024F]+)
  // 6. Mentions: @([\w\.\_]+)
  const regex = /(https?:\/\/[^\s]+)|(\*\*[^*]+?\*\*)|(\*[^*]+?\*)|(~~[^~]+?~~)|(#[a-zA-Z0-9_\u00C0-\u024F]+)|(@[a-zA-Z0-9_.]+)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    // Append preceding plain text
    if (match.index > lastIndex) {
      parts.push(line.substring(lastIndex, match.index));
    }

    const matchedStr = match[0];

    // 1. URL
    if (match[1]) {
      parts.push(
        <a
          key={match.index}
          href={matchedStr}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline break-all font-medium transition"
          onClick={(e) => e.stopPropagation()}
        >
          {matchedStr}
        </a>
      );
    }
    // 2. Bold (**text**)
    else if (match[2]) {
      const boldText = matchedStr.slice(2, -2);
      parts.push(
        <strong key={match.index} className="font-bold text-slate-900">
          {boldText}
        </strong>
      );
    }
    // 3. Italic (*text*)
    else if (match[3]) {
      const italicText = matchedStr.slice(1, -1);
      parts.push(
        <em key={match.index} className="italic">
          {italicText}
        </em>
      );
    }
    // 4. Strikethrough (~~text~~)
    else if (match[4]) {
      const strikeText = matchedStr.slice(2, -2);
      parts.push(
        <del key={match.index} className="line-through text-slate-400">
          {strikeText}
        </del>
      );
    }
    // 5. Hashtag (#tag)
    else if (match[5]) {
      parts.push(
        <span
          key={match.index}
          className={
            highlight
              ? 'text-blue-600 font-semibold hover:text-blue-700 cursor-pointer transition'
              : 'font-semibold text-slate-900'
          }
        >
          {matchedStr}
        </span>
      );
    }
    // 6. Mention (@mention)
    else if (match[6]) {
      parts.push(
        <span
          key={match.index}
          className={
            highlight
              ? 'text-blue-700 font-semibold bg-blue-50/90 px-1 py-0.5 rounded border border-blue-100 hover:bg-blue-100 cursor-pointer transition text-[95%]'
              : 'font-semibold text-slate-900'
          }
        >
          {matchedStr}
        </span>
      );
    }

    lastIndex = match.index + matchedStr.length;
  }

  if (lastIndex < line.length) {
    parts.push(line.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [line];
}

export default function RichTextRenderer({
  content,
  className = '',
  lineClamp,
  highlightMentionsAndTags = true,
}: RichTextRendererProps) {
  if (!content) return null;

  // Split by double line break for clean paragraphs
  const paragraphs = content.split(/\n{2,}/);

  return (
    <div
      className={`space-y-2.5 text-xs text-slate-800 leading-relaxed font-sans ${
        lineClamp ? `line-clamp-${lineClamp}` : ''
      } ${className}`}
    >
      {paragraphs.map((paragraph, pIdx) => {
        // Handle single line breaks inside the paragraph
        const lines = paragraph.split('\n');

        return (
          <p key={pIdx} className="leading-relaxed">
            {lines.map((line, lIdx) => (
              <React.Fragment key={lIdx}>
                {parseInlineFormatting(line, highlightMentionsAndTags)}
                {lIdx < lines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
