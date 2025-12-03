/**
 * Air Quality Data Types
 */
export type AirQualityPoint = {
  id: number;
  position: [number, number];
  aqi: number;
  location: string;
};

export type AirQualityResponse = {
  lastUpdated: string;
  source: string;
  measurements: AirQualityPoint[];
};

/**
 * Air Quality Bloc State
 *
 * Union type representing all possible states.
 * This pattern makes impossible states unrepresentable:
 * - Can't have data while loading
 * - Can't have both data and error
 * - TypeScript enforces exhaustive handling
 */
export type AirQualityState =
  | { status: "initial" }
  | { status: "loading" }
  | {
      status: "loaded";
      data: AirQualityPoint[];
      lastUpdated: Date;
      source: string;
    }
  | { status: "error"; message: string };

export const initialAirQualityState: AirQualityState = { status: "initial" };
