/**
 * SF 311 Service Request Data Types
 *
 * Represents city service requests (graffiti, potholes, etc.)
 * used for demonstrating aggregation layers (HexagonLayer, HeatmapLayer).
 */
export type Sf311Request = {
  id: number;
  position: [number, number]; // [lng, lat]
  category: string;
  neighborhood: string;
  created: string;
};

export type Sf311Response = {
  generated: string;
  source: string;
  description: string;
  count: number;
  requests: Sf311Request[];
};

/**
 * SF 311 Bloc State
 *
 * Same union pattern as AirQualityState - makes impossible states unrepresentable.
 */
export type Sf311State =
  | { status: "initial" }
  | { status: "loading" }
  | {
      status: "loaded";
      data: Sf311Request[];
      count: number;
      source: string;
    }
  | { status: "error"; message: string };

export const initialSf311State: Sf311State = { status: "initial" };
