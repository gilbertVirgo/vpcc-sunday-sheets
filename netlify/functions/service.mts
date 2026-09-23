import { addDays, londonMidnight } from "../../src/shared/dates";
import { badRequest, dateParam, guarded } from "./_shared/http";
import { praiseDb } from "./_shared/mongo";
import { fromBlock, type SongBlockDoc, type SongDoc } from "./_shared/sheet-song";

type ServiceDoc = {
  _id: string;
  date?: Date | number;
  blocks: Array<{ kind: string }>;
  updatedAt: Date;
  deletedAt?: Date | null;
};

export default guarded(async (url) => {
  const date = dateParam(url);
  if (!date) return badRequest("date=YYYY-MM-DD required");
  const start = londonMidnight(date);
  const end = londonMidnight(addDays(date, 1));

  const db = await praiseDb();
  // `date` is a BSON Date today; older writers may have stored epoch ms. Match either.
  const service = await db.collection<ServiceDoc>("services").findOne(
    {
      deletedAt: null,
      $or: [
        { date: { $gte: start, $lt: end } },
        { date: { $gte: start.getTime(), $lt: end.getTime() } },
      ],
    },
    { sort: { updatedAt: -1 } },
  );
  if (!service) return Response.json({ found: false, songs: [] });

  const blocks = service.blocks.filter((b): b is SongBlockDoc => b.kind === "song");
  const ids = blocks.flatMap((b) => (b.songId ? [b.songId] : []));
  const library = ids.length
    ? await db
        .collection<SongDoc>("songs")
        .find({ _id: { $in: ids } }, { projection: { rights: 1 } })
        .toArray()
    : [];
  const ccli = new Map(library.map((s) => [s._id, s.rights?.ccli]));

  return Response.json({
    found: true,
    songs: blocks.map((b) => fromBlock(b, b.songId ? ccli.get(b.songId) : undefined)),
  });
});
