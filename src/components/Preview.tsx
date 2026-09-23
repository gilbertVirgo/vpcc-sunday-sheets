import { useEffect, useState } from "react";
import { loadFonts } from "../lib/fonts";
import { buildPdf } from "../pdf/build";
import type { SheetInput } from "../shared/types";

export type PreviewInput = Omit<SheetInput, "fonts">;

export function Preview({ input, onFits }: { input: PreviewInput; onFits: (fits: boolean) => void }) {
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState("");

  useEffect(() => {
    let stale = false;
    const t = setTimeout(async () => {
      try {
        const { bytes, fits } = await buildPdf({ ...input, fonts: await loadFonts() });
        if (stale) return;
        const next = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
        setUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return next;
        });
        setError("");
        onFits(fits);
      } catch (e) {
        if (!stale) setError(String(e));
      }
    }, 300);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [input, onFits]);

  return (
    <section className="flex min-h-[70dvh] flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-h4">Preview</h2>
        <a
          href={url}
          download={`sunday-sheet-${input.dateISO}.pdf`}
          aria-disabled={!url}
          className="inline-flex h-11 items-center justify-center rounded-pill bg-accent px-6 text-body-sm font-bold text-accent-contrast transition-[background-color] duration-fast ease-standard hover:bg-accent-hover aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          Download PDF
        </a>
      </div>
      {error && <p role="alert" className="text-caption text-danger">{error}</p>}
      {url ? (
        <iframe title="PDF preview" src={url} className="min-h-0 w-full flex-1 rounded-md border border-line bg-surface-raised" />
      ) : (
        <p className="text-body-sm text-ink-muted">Building preview…</p>
      )}
    </section>
  );
}
