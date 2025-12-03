/**
 * SF 311 Bloc Events
 *
 * Simpler event set than AirQualityBloc - we're not doing
 * viewport-based reloading since the full dataset is local.
 */
export type Sf311Event =
  | { type: "load" }
  | { type: "refresh" }
  | { type: "clearError" };
