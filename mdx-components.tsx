import type { MDXComponents } from "mdx/types";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h2: ({ children }) => <h2 className="article-heading">{children}</h2>,
    h3: ({ children }) => <h3 className="article-subheading">{children}</h3>,
    p: ({ children }) => <p className="article-copy">{children}</p>,
    ul: ({ children }) => <ul className="article-list">{children}</ul>,
    ol: ({ children }) => <ol className="article-list article-list-numbered">{children}</ol>,
    blockquote: ({ children }) => (
      <blockquote className="article-quote">{children}</blockquote>
    ),
    strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
    ...components,
  };
}
