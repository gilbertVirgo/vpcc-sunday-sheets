import { useEffect, useState, type KeyboardEvent } from "react";
import { api } from "../api";
import type { SheetSong } from "../shared/types";

export function SongSearch({ onAdd }: { onAdd: (song: SheetSong) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SheetSong[]>([]);
  const [error, setError] = useState("");
  const [active, setActive] = useState(-1);

  useEffect(() => setActive(-1), [results]);
  useEffect(() => {
    if (active >= 0) document.getElementById(`song-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const pick = (song: SheetSong) => {
    onAdd(song);
    setQ("");
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") return setOpen(false);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      const n = results.length;
      if (n) setActive((i) => (e.key === "ArrowDown" ? (i + 1) % n : (i <= 0 ? n : i) - 1));
    } else if (e.key === "Enter" && open && results[active]) {
      e.preventDefault();
      pick(results[active]);
    }
  };

  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    let stale = false;
    setLoading(true);
    const t = setTimeout(
      () => {
        api<SheetSong[]>(`songs?q=${encodeURIComponent(query)}`)
          .then(
            (r) => {
              if (stale) return;
              setResults(r);
              setError("");
            },
            (e) => !stale && setError(String(e)),
          )
          .finally(() => !stale && setLoading(false));
      },
      query ? 250 : 0,
    );
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q, open]);

  return (
    <div className="relative">
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-controls="song-options"
        aria-activedescendant={open && active >= 0 ? `song-opt-${active}` : undefined}
        placeholder="Search songs to add…"
        aria-label="Search songs"
        aria-expanded={open}
        aria-busy={loading}
        className="w-full rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-body-sm text-ink placeholder:text-ink-muted"
      />
      {open && (
        <ul id="song-options" role="listbox" className="absolute inset-x-0 top-full z-10 mt-1 flex max-h-72 flex-col divide-y divide-line overflow-y-auto rounded-md border border-line bg-surface-raised shadow-lg">
          {error ? (
            <li role="alert" className="px-3 py-2 text-caption text-danger">{error}</li>
          ) : loading && !results.length ? (
            <li className="px-3 py-2 text-body-sm text-ink-muted">Loading songs…</li>
          ) : !results.length ? (
            <li className="px-3 py-2 text-body-sm text-ink-muted">No songs found</li>
          ) : (
            results.map((song, i) => (
              <li key={song.id} id={`song-opt-${i}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  tabIndex={-1}
                  // mousedown fires before the input's blur closes the list.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(song)}
                  onMouseEnter={() => setActive(i)}
                  className={`w-full px-3 py-2 text-left text-body-sm text-ink ${i === active ? "bg-surface-sunken" : ""} ${loading ? "opacity-60" : ""}`}
                >
                  {song.title}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
