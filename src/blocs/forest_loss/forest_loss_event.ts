/**
 * Forest Loss Bloc Events
 *
 * Events for loading H3 forest loss data at different resolutions
 * and filtering by loss year.
 */
export type ForestLossEvent =
  | { type: "load"; resolution: number }
  | { type: "setYearFilter"; minYear: number | null; maxYear: number | null }
  | { type: "clearYearFilter" }
  | { type: "clearError" };
