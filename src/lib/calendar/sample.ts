/**
 * A realistic student calendar, dated relative to today, as .ics text — so
 * "Try a sample calendar" exercises the same parser as a real file.
 */
export function sampleCalendarIcs(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = (offset: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  const stamp = (d: Date, h: number, m = 0) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(h)}${pad(m)}00`;
  const date = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  // Monday of this week, so weekly classes start in the past like a real term.
  const monday = day(-((now.getDay() + 6) % 7));
  const weekday = (base: Date, dow: number) =>
    new Date(base.getFullYear(), base.getMonth(), base.getDate() + ((dow + 6) % 7));

  const event = (lines: string[]) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"];
  const weekly = (uid: string, title: string, dow: number[], h: number, m: number, mins: number, where: string) => {
    const first = weekday(monday, dow[0]);
    const end = new Date(first.getTime() + (h * 60 + m + mins) * 60_000);
    return event([
      `UID:${uid}@sample.scribe`,
      `SUMMARY:${title}`,
      `DTSTART:${stamp(first, h, m)}`,
      `DTEND:${stamp(first, end.getHours(), end.getMinutes())}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${dow.map((d) => ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][d]).join(",")};COUNT=30`,
      `LOCATION:${where}`,
    ]);
  };
  const timed = (uid: string, title: string, offset: number, h: number, m: number, mins: number, where?: string) => {
    const d = day(offset);
    const end = new Date(d.getTime() + (h * 60 + m + mins) * 60_000);
    return event([
      `UID:${uid}@sample.scribe`,
      `SUMMARY:${title}`,
      `DTSTART:${stamp(d, h, m)}`,
      `DTEND:${stamp(end, end.getHours(), end.getMinutes())}`,
      ...(where ? [`LOCATION:${where}`] : []),
    ]);
  };

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Scribe//Sample calendar//EN",
    "X-WR-CALNAME:Sample school calendar",
    ...weekly("chem-lecture", "Chemistry HL lecture", [1, 3, 5], 9, 0, 90, "Science block, room 2"),
    ...weekly("hist-seminar", "History seminar", [2, 4], 13, 0, 75, "Humanities 104"),
    ...weekly("span-class", "Spanish B class", [1, 4], 11, 0, 60, "Languages 3"),
    ...weekly("phys-lab", "Physics lab", [3], 15, 0, 120, "Physics lab A"),
    ...weekly("soccer", "Soccer practice", [2, 4], 16, 30, 90, "Field 2"),
    ...timed("chem-p1", "Chemistry HL Paper 1", 9, 9, 0, 90, "Exam hall"),
    ...timed("span-oral", "Spanish B oral exam", 13, 10, 0, 20, "Languages 3"),
    ...timed("phys-quiz", "Physics mechanics quiz", 5, 15, 0, 30, "Physics lab A"),
    ...timed("hist-essay", "History essay due", 6, 23, 59, 0),
    ...event([
      "UID:phys-pset@sample.scribe",
      "SUMMARY:Physics problem set 3",
      `DTSTART;VALUE=DATE:${date(day(11))}`,
      `DTEND;VALUE=DATE:${date(day(12))}`,
    ]),
    ...timed("dentist", "Dentist", 3, 17, 0, 45),
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
