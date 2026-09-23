import type { SheetSection, SheetSong } from "../../../src/shared/types";

/** A `kind:'song'` block inside a praise-pres service: a snapshot of the library song. */
export type SongBlockDoc = {
  kind: "song";
  id: string;
  title: string;
  songId?: string;
  sections: SheetSection[];
  sequence: string[];
  attribution?: string;
};

/** A praise-pres `songs` document (fields we read). */
export type SongDoc = {
  _id: string;
  title: string;
  sections: SheetSection[];
  defaultSequence: string[];
  attribution: string;
  rights?: { status?: string; ccli?: string };
};

export const fromBlock = (b: SongBlockDoc, ccli?: string): SheetSong => ({
  id: b.id,
  title: b.title,
  sections: b.sections ?? [],
  sequence: b.sequence ?? [],
  attribution: b.attribution ?? "",
  ...(ccli ? { ccli } : {}),
});

export const fromSongDoc = (d: SongDoc): SheetSong => ({
  id: d._id,
  title: d.title,
  sections: d.sections ?? [],
  sequence: d.defaultSequence ?? [],
  attribution: d.attribution ?? "",
  ...(d.rights?.ccli ? { ccli: d.rights.ccli } : {}),
});
