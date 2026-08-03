import type { ReactNode } from "react";

/**
 * Minimal markdown rendering for LLM-generated text (AI Tutor answers,
 * generated summaries). LLM output routinely includes basic markdown
 * (bold, bullet lists) — rendering it as plain text leaves visible `**`
 * markers, so this handles the common subset without pulling in a full
 * markdown library for what is otherwise plain prose.
 */
export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);

  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim().length > 0);
        if (lines.length === 0) return null;

        if (lines.length === 1 && /^(-{3,}|\*{3,})$/.test(lines[0].trim())) {
          return <hr key={i} className="my-3 border-slate-200" />;
        }

        const heading = lines[0].match(/^(#{1,3})\s+(.*)$/);
        if (heading && lines.length === 1) {
          const level = heading[1].length;
          const className = level === 1 ? "mt-3 mb-1 text-base font-bold" : level === 2 ? "mt-3 mb-1 text-sm font-bold" : "mt-2 mb-1 text-sm font-semibold";
          return (
            <p key={i} className={className}>
              {renderInline(heading[2])}
            </p>
          );
        }

        const isList = lines.every((l) => /^[*-]\s+/.test(l.trim()));
        if (isList) {
          return (
            <ul key={i} className="my-2 list-disc space-y-1 pl-5">
              {lines.map((line, j) => (
                <li key={j}>{renderInline(line.trim().replace(/^[*-]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={i} className="whitespace-pre-wrap">
            {lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {renderInline(line)}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

function renderInline(text: string): ReactNode[] {
  // Bold must be checked before single-asterisk italic in the alternation
  // so "**x**" isn't first split into two dangling "*" + "*x*" + "*" pieces.
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <span key={i}>{part}</span>;
  });
}
