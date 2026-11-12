import ReactMarkdown from "react-markdown";

/** Renders agent replies (Markdown from the API) with compact, theme-aware styling. No raw HTML is allowed. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown break-words">
      <ReactMarkdown
        components={{
          a: ({ children: c, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-[var(--accent-text)] underline">
              {c}
            </a>
          ),
          code: ({ children: c }) => <code className="inline-code">{c}</code>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
