export type SheetSection = { id: string; label: string; lines: string[] };

export type SheetSong = {
  id: string;
  title: string;
  sections: SheetSection[];
  /** Section ids in performance order; repeats allowed (the leaflet prints each once). */
  sequence: string[];
  attribution: string;
  ccli?: string;
};

export type Notice = {
  title: string;
  /** "Wednesday" */
  day: string;
  /** "7:30pm" or "" */
  time: string;
  location: string;
  description: string;
};

/** Short quote printed at the top of the cover flow, e.g. a Bible verse. Empty text = none. */
export type Quote = { text: string; source: string };

export type SheetInput = {
  /** YYYY-MM-DD */
  dateISO: string;
  /** Free text, e.g. "3:15pm" */
  time: string;
  songs: SheetSong[];
  /** One paragraph per entry. */
  notices: string[];
  quote?: Quote;
  rotateBack: boolean;
  /** Inter static TTF bytes. Passed in so buildPdf stays DOM- and fetch-free. */
  fonts: { regular: Uint8Array; bold: Uint8Array };
};
