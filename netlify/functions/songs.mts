import { guarded } from "./_shared/http";
import { praiseDb } from "./_shared/mongo";
import { fromSongDoc, type SongDoc } from "./_shared/sheet-song";

const PROJECTION = { title: 1, sections: 1, defaultSequence: 1, attribution: 1, rights: 1 };
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default guarded(async (url) => {
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const songs = (await praiseDb()).collection<SongDoc>("songs");
  // ponytail: empty query returns the whole library for the browse dropdown; paginate if it grows past a few hundred.
  if (!q) return Response.json((await songs.find({}, { projection: PROJECTION, sort: { title: 1 } }).toArray()).map(fromSongDoc));

  let docs = await songs
    .find(
      { $text: { $search: q } },
      { projection: { ...PROJECTION, score: { $meta: "textScore" } }, sort: { score: { $meta: "textScore" } }, limit: 20 },
    )
    .toArray();
  // $text matches whole words only; fall back to a title substring so "amaz" finds "Amazing Grace".
  if (!docs.length) {
    docs = await songs
      .find({ title: { $regex: escapeRegex(q), $options: "i" } }, { projection: PROJECTION, sort: { title: 1 }, limit: 20 })
      .toArray();
  }
  return Response.json(docs.map(fromSongDoc));
});
