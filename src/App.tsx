import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { NoticesEditor } from "./components/NoticesEditor";
import { Preview } from "./components/Preview";
import { SongList } from "./components/SongList";
import { SongSearch } from "./components/SongSearch";
import { noticeParagraphs, noticesText } from "./lib/notices";
import { nextSunday } from "./shared/dates";
import type { Notice, SheetSong } from "./shared/types";

const field = "w-full rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-body-sm font-medium text-ink";

export function App() {
  const [authed, setAuthed] = useState(false);
  const [date, setDate] = useState(() => nextSunday(new Date()));
  const [time, setTime] = useState("3:15pm");
  const [songs, setSongs] = useState<SheetSong[]>([]);
  const [found, setFound] = useState(true);
  const [notices, setNotices] = useState("");
  const [rotateBack, setRotateBack] = useState(true);
  const [fits, setFits] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api("me").then(() => setAuthed(true), (e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!authed || !date) return;
    let stale = false;
    api<{ found: boolean; songs: SheetSong[] }>(`service?date=${date}`).then(
      (r) => {
        if (stale) return;
        setSongs(r.songs);
        setFound(r.found);
      },
      (e) => setError(String(e)),
    );
    api<Notice[]>(`notices?date=${date}`).then(
      (n) => !stale && setNotices(noticesText(n)),
      (e) => setError(String(e)),
    );
    return () => {
      stale = true;
    };
  }, [authed, date]);

  const reloadNotices = () =>
    api<Notice[]>(`notices?date=${date}`).then((n) => setNotices(noticesText(n)), (e) => setError(String(e)));

  const input = useMemo(
    () => ({ dateISO: date, time, songs, notices: noticeParagraphs(notices), rotateBack }),
    [date, time, songs, notices, rotateBack],
  );

  if (!authed) return <p className="p-8 text-body-sm text-ink-muted">{error || "Checking sign-in…"}</p>;

  return (
    <main className="grid min-h-dvh gap-6 p-6 md:h-dvh md:grid-cols-[26rem_1fr]">
      <div className="flex flex-col gap-6 md:overflow-y-auto md:pr-2">
        <h1 className="text-h3">Sunday sheet</h1>
        {error && <p role="alert" className="rounded-md bg-danger-surface px-3 py-2 text-body-sm text-danger">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-body-sm font-bold text-ink">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-body-sm font-bold text-ink">
            Time
            <input value={time} onChange={(e) => setTime(e.target.value)} className={field} />
          </label>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-body-sm font-bold text-ink">Songs</h2>
          {!found && <p className="text-caption text-ink-muted">No Praise Presenter service for this date.</p>}
          <SongList songs={songs} onChange={setSongs} />
          <SongSearch onAdd={(song) => setSongs((prev) => [...prev, song])} />
        </section>

        <NoticesEditor value={notices} onChange={setNotices} onReload={reloadNotices} />

        <label className="flex items-center gap-2 text-body-sm text-ink">
          <input type="checkbox" checked={rotateBack} onChange={(e) => setRotateBack(e.target.checked)} />
          Rotate back page for duplex
        </label>

        {!fits && (
          <p role="alert" className="rounded-md bg-danger-surface px-3 py-2 text-body-sm text-danger">
            This doesn't fit even at 7 pt. Remove a song or shorten the notices.
          </p>
        )}
      </div>

      <Preview input={input} onFits={setFits} />
    </main>
  );
}
