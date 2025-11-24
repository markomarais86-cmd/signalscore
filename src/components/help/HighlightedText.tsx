interface HighlightedTextProps {
  text: string;
  query: string;
}

export function HighlightedText({ text, query }: HighlightedTextProps) {
  if (!query || query.trim().length === 0) {
    return <>{text}</>;
  }

  const normalizedQuery = query.toLowerCase().trim();
  const index = text.toLowerCase().indexOf(normalizedQuery);

  if (index === -1) {
    return <>{text}</>;
  }

  const before = text.substring(0, index);
  const match = text.substring(index, index + query.length);
  const after = text.substring(index + query.length);

  return (
    <>
      {before}
      <mark className="bg-primary/30 text-foreground">{match}</mark>
      {after}
    </>
  );
}
