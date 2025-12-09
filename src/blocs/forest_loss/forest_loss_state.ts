/**
 * Forest Loss Cell - H3 hexagon with aggregated loss data
 */
export type ForestLossCell = {
  h3: string; // H3 index hex string
  totalLoss: number; // Total pixels with loss
  byYear: Record<number, number>; // Loss count by year (1-23 = 2001-2023)
};

/**
 * Geographic bounds
 */
export type Bounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

/**
 * Forest Loss Response from service
 */
export type ForestLossResponse = {
  generated: string;
  source: string;
  resolution: number;
  bounds: Bounds;
  sampleRate: number;
  totalCells: number;
  cells: ForestLossCell[];
};

/**
 * Year filter for visualizing specific time periods
 */
export type YearFilter = {
  minYear: number | null; // null = no min filter (years 1-23)
  maxYear: number | null; // null = no max filter
};

/**
 * Forest Loss Bloc State
 *
 * Union type with resolution tracking and optional year filtering.
 * Caches loaded resolutions to avoid re-fetching.
 */
export type ForestLossState =
  | { status: "initial" }
  | { status: "loading"; resolution: number }
  | {
      status: "loaded";
      resolution: number;
      data: ForestLossCell[];
      bounds: Bounds;
      source: string;
      yearFilter: YearFilter;
      cache: Map<number, ForestLossCell[]>;
    }
  | { status: "error"; message: string; resolution: number };

export const initialForestLossState: ForestLossState = { status: "initial" };
