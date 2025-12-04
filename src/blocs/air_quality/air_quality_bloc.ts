import { Bloc } from "@granite-crisp/react-bloc";
import type { AirQualityService } from "../../services/air_quality_service";
import { HttpAirQualityService } from "../../services/air_quality_service";
import type { MapBloc } from "../map/map_bloc";
import type { AirQualityEvent } from "./air_quality_event";
import type { AirQualityState } from "./air_quality_state";
import { initialAirQualityState } from "./air_quality_state";

/**
 * AirQualityBloc - Demonstrates async BLoC pattern with bloc-to-bloc communication
 *
 * Key concepts:
 * 1. Service injection - The bloc receives a service interface, not a concrete class.
 *    This enables testing with mocks and swapping implementations.
 *
 * 2. Union state - State is one of: initial | loading | loaded | error
 *    TypeScript enforces exhaustive handling in consumers.
 *
 * 3. Async event handlers - The add() method dispatches to private async handlers.
 *    Each handler manages its own loading/success/error transitions.
 *
 * 4. Bloc-to-bloc subscription - Can subscribe to MapBloc and reload data when
 *    the viewport changes significantly. Debouncing is handled internally.
 */
export class AirQualityBloc extends Bloc<AirQualityEvent, AirQualityState> {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastLoadedCenter: { longitude: number; latitude: number } | null =
    null;

  // Threshold in degrees - roughly 5-10km depending on latitude
  private static readonly RELOAD_THRESHOLD = 0.05;
  private static readonly DEBOUNCE_MS = 500;

  constructor(
    private service: AirQualityService = new HttpAirQualityService()
  ) {
    super(initialAirQualityState);
  }

  /**
   * Connect this bloc to a MapBloc.
   *
   * When connected, this bloc will automatically reload data when the user
   * pans to a significantly different region. Debouncing prevents reload spam
   * during continuous pan/zoom gestures.
   *
   * This is the bloc-to-bloc communication pattern:
   * - No React hooks involved
   * - Pure TypeScript subscription
   * - Cleanup handled via dispose()
   */
  connectToMap(mapBloc: MapBloc): void {
    // Capture initial position as baseline for threshold comparison
    const { longitude, latitude } = mapBloc.state.viewState;
    this.lastLoadedCenter = { longitude, latitude };

    const unsubscribe = mapBloc.subscribe((mapState) => {
      const { longitude, latitude, zoom } = mapState.viewState;
      this.add({ type: "viewportChanged", longitude, latitude, zoom });
    });

    this.addSubscription(unsubscribe);
  }

  add(event: AirQualityEvent): void {
    switch (event.type) {
      case "load":
        // Only load if we're in initial state (first load)
        if (this.state.status === "initial") {
          this.handleLoad();
        }
        break;

      case "refresh":
        // Refresh can happen from any state
        this.handleLoad();
        break;

      case "clearError":
        if (this.state.status === "error") {
          this.emitState(initialAirQualityState);
        }
        break;

      case "viewportChanged":
        this.handleViewportChanged(event.longitude, event.latitude);
        break;
    }
  }

  /**
   * Debounced viewport change handler.
   *
   * Only triggers a reload if:
   * 1. We've already loaded data at least once
   * 2. The center has moved beyond the threshold
   * 3. Debounce timer has elapsed (user stopped panning)
   */
  private handleViewportChanged(longitude: number, latitude: number): void {
    // Clear any pending debounce
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Only reload if we have previous data and center moved significantly
    if (!this.lastLoadedCenter || !this.shouldReload(longitude, latitude)) {
      return;
    }

    const center = { longitude, latitude };

    // Debounce: wait for user to stop panning
    this.debounceTimer = setTimeout(() => {
      this.handleLoad(center);
    }, AirQualityBloc.DEBOUNCE_MS);
  }

  private shouldReload(longitude: number, latitude: number): boolean {
    if (!this.lastLoadedCenter) return false;

    const deltaLon = Math.abs(longitude - this.lastLoadedCenter.longitude);
    const deltaLat = Math.abs(latitude - this.lastLoadedCenter.latitude);

    return (
      deltaLon > AirQualityBloc.RELOAD_THRESHOLD ||
      deltaLat > AirQualityBloc.RELOAD_THRESHOLD
    );
  }

  /**
   * Private async handler for loading data.
   *
   * Pattern:
   * 1. Emit loading state immediately
   * 2. Await async operation
   * 3. Emit success or error state
   *
   * Note: We use emit() with the full state object since we're using
   * union types, not a single object with optional fields.
   */
  private async handleLoad(center?: {
    longitude: number;
    latitude: number;
  }): Promise<void> {
    // emitState replaces the entire state (for union types)
    this.emitState({ status: "loading" });

    try {
      const response = await this.service.fetchMeasurements();

      // Track where we loaded data for threshold comparison
      if (center) {
        this.lastLoadedCenter = center;
      }

      this.emitState({
        status: "loaded",
        data: response.measurements,
        lastUpdated: new Date(response.lastUpdated),
        source: response.source,
      });
    } catch (e) {
      this.emitState({
        status: "error",
        message: e instanceof Error ? e.message : "Unknown error occurred",
      });
    }
  }

  /**
   * Clean up timers and subscriptions.
   */
  override dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    super.dispose();
  }
}
