import { addDays, londonMidnight } from "../../src/shared/dates";
import { badRequest, dateParam, guarded } from "./_shared/http";
import { calendarDb } from "./_shared/mongo";
import { type EventDoc, selectNotices } from "./_shared/notices";

export default guarded(async (url) => {
  const date = dateParam(url);
  if (!date) return badRequest("date=YYYY-MM-DD required");
  const start = londonMidnight(date);
  const end = londonMidnight(addDays(date, 7));

  const events = await (await calendarDb())
    .collection<EventDoc>("events")
    .find({
      visibility: { $ne: "private" },
      $or: [
        { date: { $gte: start, $lt: end } },
        {
          recursWeekly: true,
          date: { $lt: start },
          $or: [
            { "recursionDetails.endDate": { $exists: false } },
            { "recursionDetails.endDate": null },
            { "recursionDetails.endDate": { $gte: start } },
          ],
        },
      ],
    })
    .toArray();

  return Response.json(selectNotices(events, date));
});
