import type { SheetSong } from "../shared/types";

const iconButton =
  "rounded-sm px-2 py-1 text-caption text-ink-secondary hover:bg-surface-sunken disabled:opacity-30 disabled:hover:bg-transparent";

export function SongList({ songs, onChange }: { songs: SheetSong[]; onChange: (songs: SheetSong[]) => void }) {
  const move = (i: number, by: -1 | 1) => {
    const next = [...songs];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    onChange(next);
  };

  if (!songs.length) return <p className="text-body-sm text-ink-muted">No songs yet. Search below to add one.</p>;

  return (
    <ol className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface-raised">
      {songs.map((song, i) => (
        <li key={`${i}-${song.id}`} className="flex items-center gap-2 px-3 py-2">
          <span className="w-5 text-body-sm font-bold text-ink-muted">{i + 1}</span>
          <span className="flex-1 truncate text-body-sm text-ink">{song.title}</span>
          <button type="button" className={iconButton} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${song.title} up`}>
            ↑
          </button>
          <button type="button" className={iconButton} disabled={i === songs.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${song.title} down`}>
            ↓
          </button>
          <button type="button" className={iconButton} onClick={() => onChange(songs.filter((_, j) => j !== i))} aria-label={`Remove ${song.title}`}>
            ✕
          </button>
        </li>
      ))}
    </ol>
  );
}
