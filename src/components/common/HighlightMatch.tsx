import React from 'react';

/**
 * Escapes regex special characters to prevent invalid RegExp construction
 */
export const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Extracts unique search terms from query (split by spaces, min length 1)
 */
export const getSearchTerms = (query: string): string[] => {
  if (!query) return [];
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeRegExp)
    .sort((a, b) => b.length - a.length);
};

/**
 * Checks if a text matches any or all of the query terms
 */
export const hasMatch = (text: string | undefined | null, query: string): boolean => {
  if (!text || !query.trim()) return false;
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const lower = text.toLowerCase();
  return terms.some((t) => lower.includes(t));
};

interface HighlightMatchProps {
  text: string | undefined | null;
  query: string;
  highlightClassName?: string;
  className?: string;
}

/**
 * Renders text with real-time highlighted matches based on the user search query.
 */
export const HighlightMatch: React.FC<HighlightMatchProps> = ({
  text,
  query,
  highlightClassName = 'bg-[#38bdf8]/30 text-white font-bold px-1 py-0.2 rounded border border-[#38bdf8]/40 shadow-xs',
  className
}) => {
  if (!text) return null;
  const terms = getSearchTerms(query);
  if (terms.length === 0) {
    return className ? <span className={className}>{text}</span> : <>{text}</>;
  }

  try {
    const pattern = new RegExp(`(${terms.join('|')})`, 'gi');
    const parts = text.split(pattern);

    return (
      <span className={className}>
        {parts.map((part, index) => {
          if (!part) return null;
          const isMatch = terms.some((term) =>
            new RegExp(`^${term}$`, 'i').test(part)
          );

          if (isMatch) {
            return (
              <mark
                key={index}
                className={`not-italic inline-block ${highlightClassName}`}
              >
                {part}
              </mark>
            );
          }

          return <React.Fragment key={index}>{part}</React.Fragment>;
        })}
      </span>
    );
  } catch {
    // Fallback if regex fails on unexpected input
    return className ? <span className={className}>{text}</span> : <>{text}</>;
  }
};
