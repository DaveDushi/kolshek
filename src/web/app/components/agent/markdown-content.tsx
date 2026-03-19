// Markdown renderer for assistant chat messages
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface MarkdownContentProps {
  content: string;
}

// Custom component overrides for clean chat-style rendering
const components: Components = {
  // Paragraphs — no extra margin on first/last
  p: ({ children }) => (
    <p className="mb-3 last:mb-0">{children}</p>
  ),

  // Bold
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),

  // Inline code
  code: ({ children, className }) => {
    // Block code gets a className like "language-sql" from remark
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return <code className={className}>{children}</code>;
    }
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 text-[0.85em] font-mono text-foreground">
        {children}
      </code>
    );
  },

  // Code blocks
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-lg bg-surface-sunken border border-border p-3 text-[13px] leading-relaxed font-mono">
      {children}
    </pre>
  ),

  // Tables — the main issue in the screenshot
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/50 border-b border-border">
      {children}
    </thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-border">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-muted/30 transition-colors">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-sm text-foreground">{children}</td>
  ),

  // Lists
  ul: ({ children }) => (
    <ul className="mb-3 ml-4 list-disc space-y-1 marker:text-muted-foreground last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 ml-4 list-decimal space-y-1 marker:text-muted-foreground last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="pl-0.5">{children}</li>
  ),

  // Headings — scale down for chat context
  h1: ({ children }) => (
    <h1 className="mb-2 mt-4 text-base font-semibold text-foreground first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-3 text-sm font-semibold text-foreground first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1.5 mt-2.5 text-sm font-medium text-foreground first:mt-0">{children}</h3>
  ),

  // Horizontal rule
  hr: () => (
    <hr className="my-3 border-border" />
  ),

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-primary/30 pl-3 text-muted-foreground italic">
      {children}
    </blockquote>
  ),

  // Links
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  ),
};

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="text-[15px] leading-7 text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
