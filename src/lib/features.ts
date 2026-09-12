/**
 * What the app shows.
 *
 * Our Space starts as one thing: a place to write down who the two of you are.
 * Everything else from the spec is built and tested — moments, the timeline,
 * the calendar, memories, the bucket list, search — but hidden, so the app you
 * open every day stays small.
 *
 * To bring a piece back, flip its flag to `true`. That is the whole change:
 * the navigation, the home screen and the routes all read from here. The data
 * model and the API are untouched either way, so nothing already saved is
 * affected by turning something off again.
 */
export const features = {
  /** The introduction sheet each of you fills in, and the pair of them. */
  sheets: true,

  // --- turned off for now ---------------------------------------------------
  /**
   * The older free-form likes list, grouped by category. The sheet covers the
   * same ground with fixed slots, so having both on screen only duplicates it.
   */
  preferences: false,

  /** Daily moments: photos, captions, moods. Brings back Add moment. */
  moments: false,
  /** The scrolling history of every moment. Needs `moments`. */
  timeline: false,
  /** Month grid with a marker on days that have something. */
  calendar: false,
  /** Curated milestones with a cover photo. */
  memories: false,
  /** Anniversaries and birthdays, with a countdown. */
  importantDates: false,
  /** Things to do together. */
  bucketList: false,
  /** Search across everything above. */
  search: false,
} as const;

export type Feature = keyof typeof features;

export function isEnabled(feature: Feature): boolean {
  return features[feature];
}
