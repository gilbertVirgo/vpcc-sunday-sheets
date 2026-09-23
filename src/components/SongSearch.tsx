import { useEffect, useState } from "react";
import { api } from "../api";
import type { SheetSong } from "../shared/types";

export function SongSearch({ onAdd }: { onAdd: (song: SheetSong) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SheetSong[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults([]);
      return;
    }
    let stale = false;
    const t = setTimeout(() => {
      api<SheetSong[]>(`songs?q=${encodeURIComponent(query)}`).then(
        (r) => {
          if (!stale) {
            setResults(r);
            setError("");
          }
        },
        (e) => !stale && setError(String(e)),
      );
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search songs to add…"
        aria-label="Search songs"
        className="w-full rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-body-sm text-ink placeholder:text-ink-muted"
      />
      {error && <p role="alert" className="text-caption text-danger">{error}</p>}
      {results.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface-raised">
          {results.map((song) => (
            <li key={song.id}>
              <button
                type="button"
                onClick={() => {
                  onAdd(song);
                  setQ("");
                }}
                className="w-full px-3 py-2 text-left text-body-sm text-ink hover:bg-surface-sunken"
              >
                {song.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
