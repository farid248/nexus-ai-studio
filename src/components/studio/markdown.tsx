"use client";

import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-border/70">
      <div className="flex items-center justify-between bg-zinc-900 px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
          {language || "code"}
        </span>
        <button
          onClick={copy}
          aria-label="Copy code"
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copy
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={oneDark as Record<string, React.CSSProperties>}
        customStyle={{ margin: 0, fontSize: "0.8rem", background: "#0b0f0d" }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

const components: Components = {
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const match = /language-(\w+)/.exec(className || "");
    const text = String(children).replace(/\n$/, "");
    if (!match) {
      return (
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">
          {children}
        </code>
      );
    }
    return <CodeBlock language={match[1]} code={text} />;
  },
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  h1: ({ children }) => <h1 className="mb-2 mt-3 text-lg font-semibold first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-2.5 text-sm font-semibold first:mt-0">{children}</h3>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-primary/60 pl-3 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border/70" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-border/70">
      <table className="w-full text-left text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border/70 bg-secondary/50 px-3 py-2 font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border-b border-border/50 px-3 py-2 last:border-0">{children}</td>,
};

export function Markdown({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed break-words">
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}
