/** Render untrusted text as escaped plain text — never use dangerouslySetInnerHTML */
export function SafeContent({ text, className }: { text: string | null | undefined; className?: string }) {
  if (text == null || text === "") {
    return <span className="text-muted-foreground text-sm">-</span>;
  }
  return (
    <pre
      className={`whitespace-pre-wrap break-words font-sans text-sm leading-relaxed ${className ?? ""}`}
    >
      {text}
    </pre>
  );
}
