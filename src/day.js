// One definition of "a day" for the whole app.
//
// A day runs 05:00 -> 04:59 the next morning, not midnight to midnight, so a
// session that runs past midnight still belongs to the day it started in.
// Reviewing a card at 01:00 counts as the previous day, and the new day only
// begins when you actually wake up.
export const DAY_START_HOUR = 5;
export const DAY_MS = 86400000;

/** 05:00 of the day the given moment belongs to, in local time. */
export function dayStart(date = new Date()) {
  const d = new Date(date);
  if (d.getHours() < DAY_START_HOUR) d.setDate(d.getDate() - 1);
  d.setHours(DAY_START_HOUR, 0, 0, 0);
  return d;
}

/** "2026-09-06" for the day the given moment belongs to. */
export function dayKey(date = new Date()) {
  const d = dayStart(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Midday of a "YYYY-MM-DD" key -- safe to format or compare with. */
export function parseDay(key) {
  const [y, m, d] = String(key).split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

/** How many days apart two moments are, counted in 05:00 day boundaries. */
export function daysBetween(a, b = new Date()) {
  return Math.round((dayStart(a) - dayStart(b)) / DAY_MS);
}

/** 05:00 of the day that is `days` days after the day `from` belongs to. */
export function startOfDayAfter(days, from = new Date()) {
  const d = dayStart(from);
  d.setDate(d.getDate() + days);
  return d;
}

export const formatDayTH = (key, options = { day: "numeric", month: "long", year: "numeric" }) =>
  parseDay(key).toLocaleDateString("th-TH", options);

/**
 * Length of the run of consecutive days ending today, counted with the 05:00
 * boundary. Today not being logged yet does not break it -- the run is still
 * alive until a whole day passes with nothing in it -- but a gap does, and the
 * count starts again from the next day that has something.
 */
export function countStreak(keys, today = dayKey()) {
  const days = new Set(keys);
  if (!days.size) return 0;
  const cursor = parseDay(today);
  // Yesterday still counts: the day is not over until you have slept through it.
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  if (!days.has(dayKey(cursor))) return 0;
  let run = 0;
  while (days.has(dayKey(cursor))) {
    run++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return run;
}
