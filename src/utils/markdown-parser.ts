// src/utils/markdown-parser.ts

/**
 * A simple Markdown to HTML converter
 * This is intentionally basic to keep file size small
 */
export function parseMarkdown(markdown: string): string {
  if (!markdown) return "";

  let html = markdown;

  // Escape HTML characters
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headers
  html = html.replace(/^### (.*$)/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gm, "<h1>$1</h1>");

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Lists
  // First, separate lists with a special marker
  html = html.replace(/(\n\d+\..+)(?=\n[^\d\n])/g, "$1\n<!––end-list––>");
  html = html.replace(/(\n- .+)(?=\n[^-\n])/g, "$1\n<!––end-list––>");

  // Ordered lists
  html = html.replace(/^\d+\. (.*$)/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n)+/g, "<ol>$&</ol>");

  // Unordered lists
  html = html.replace(/^- (.*$)/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n)+/g, "<ul>$&</ul>");

  // Remove list markers
  html = html.replace(/<!––end-list––>/g, "");

  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Paragraphs - Process last
  html = html.replace(/^\s*$(?:\r\n?|\n)/gm, "</p><p>");
  html = "<p>" + html + "</p>";
  html = html.replace(/<\/p><p><\/p><p>/g, "</p><p>");
  html = html.replace(/<p><\/p>/g, "");

  // Fix lists within paragraphs
  html = html.replace(/<p>(<[ou]l>)/g, "$1");
  html = html.replace(/(<\/[ou]l>)<\/p>/g, "$1");

  return html;
}
