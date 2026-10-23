import type { ReactNode } from "react";

/**
 * Minimal markdown renderer for the drafted report.
 *
 * The model emits headings, bullets and bold spans and nothing else, so a full
 * markdown dependency would be weight for no gain. Anything unrecognised falls
 * through as a paragraph rather than being dropped.
 */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-black">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function ReportBody({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const out: ReactNode[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (!bullets.length) return;
    out.push(
      <ul key={`ul-${out.length}`} className="ml-4 list-disc space-y-1">
        {bullets.map((b, i) => (
          <li key={i}>{inline(b)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      bullets.push(trimmed.slice(2));
      continue;
    }
    flush();
    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      out.push(
        <h3
          key={`h-${out.length}`}
          className="pt-2 text-[14px] font-bold uppercase tracking-wide text-black"
        >
          {heading[2]}
        </h3>,
      );
      continue;
    }
    out.push(<p key={`p-${out.length}`}>{inline(trimmed)}</p>);
  }
  flush();

  return <div className="space-y-2">{out}</div>;
}
