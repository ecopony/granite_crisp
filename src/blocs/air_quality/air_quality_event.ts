/**
 * Air Quality Bloc Events
 *
 * Discriminated union of all events the bloc can handle.
 * Each event represents a user action or system trigger.
 */
export type AirQualityEvent =
  | { type: "load" }
  | { type: "refresh" }
  | { type: "clearError" }
  | {
      type: "viewportChanged";
      longitude: number;
      latitude: number;
      zoom: number;
    };
