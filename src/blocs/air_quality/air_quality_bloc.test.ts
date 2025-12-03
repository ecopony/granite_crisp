import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { AirQualityBloc } from "./air_quality_bloc";
import { MapBloc } from "../map/map_bloc";
import type { AirQualityResponse } from "./air_quality_state";
import {
  MockAirQualityService,
  type AirQualityService,
} from "../../services/air_quality_service";

/**
 * AirQualityBloc Tests
 *
 * Demonstrates:
 * 1. Async event handling - testing loading/success/error state transitions
 * 2. Service injection - injecting mock services for deterministic tests
 * 3. Union state testing - verifying the correct state variant is emitted
 *
 * The bloc's constructor accepts a service interface, so we can inject
 * mocks that return immediately (no network delays, no flaky tests).
 */

// Sample test data
const mockResponse: AirQualityResponse = {
  lastUpdated: "2024-01-15T10:30:00Z",
  source: "Test Data",
  measurements: [
    { id: 1, position: [-122.4, 37.7], aqi: 42, location: "Test Location A" },
    { id: 2, position: [-122.3, 37.8], aqi: 85, location: "Test Location B" },
  ],
};

describe("AirQualityBloc", () => {
  describe("with successful service", () => {
    let bloc: AirQualityBloc;
    let mockService: MockAirQualityService;

    beforeEach(() => {
      mockService = new MockAirQualityService(mockResponse);
      bloc = new AirQualityBloc(mockService);
    });

    describe("initial state", () => {
      it("should start in initial status", () => {
        expect(bloc.state.status).toBe("initial");
      });
    });

    describe("load event", () => {
      it("should transition to loading then loaded", async () => {
        // Track all state transitions
        const states: string[] = [];
        bloc.subscribe((state) => states.push(state.status));

        bloc.add({ type: "load" });

        // Wait for async operation
        await vi.waitFor(() => {
          expect(bloc.state.status).toBe("loaded");
        });

        // Should have transitioned through loading
        expect(states).toContain("loading");
        expect(states).toContain("loaded");
      });

      it("should populate data on success", async () => {
        bloc.add({ type: "load" });

        await vi.waitFor(() => {
          expect(bloc.state.status).toBe("loaded");
        });

        // Type narrowing - TypeScript knows this is the loaded variant
        if (bloc.state.status === "loaded") {
          expect(bloc.state.data).toHaveLength(2);
          expect(bloc.state.data[0]!.location).toBe("Test Location A");
          expect(bloc.state.source).toBe("Test Data");
          expect(bloc.state.lastUpdated).toBeInstanceOf(Date);
        }
      });

      it("should not reload if already loaded (use refresh instead)", async () => {
        // First load
        bloc.add({ type: "load" });
        await vi.waitFor(() => expect(bloc.state.status).toBe("loaded"));

        // Create a spy to track service calls
        const fetchSpy = vi.spyOn(mockService, "fetchMeasurements");

        // Try to load again
        bloc.add({ type: "load" });

        // Should not have called the service again
        expect(fetchSpy).not.toHaveBeenCalled();
      });
    });

    describe("refresh event", () => {
      it("should reload data even if already loaded", async () => {
        // First load
        bloc.add({ type: "load" });
        await vi.waitFor(() => expect(bloc.state.status).toBe("loaded"));

        const fetchSpy = vi.spyOn(mockService, "fetchMeasurements");

        // Refresh should reload
        bloc.add({ type: "refresh" });

        await vi.waitFor(() => {
          expect(fetchSpy).toHaveBeenCalled();
        });
      });

      it("should work from error state", async () => {
        // Create a bloc with failing service
        const failingService = new MockAirQualityService(mockResponse, true);
        const errorBloc = new AirQualityBloc(failingService);

        // Trigger error
        errorBloc.add({ type: "load" });
        await vi.waitFor(() => expect(errorBloc.state.status).toBe("error"));

        // Fix the service and refresh
        vi.spyOn(failingService, "fetchMeasurements").mockResolvedValue(
          mockResponse
        );
        errorBloc.add({ type: "refresh" });

        await vi.waitFor(() => expect(errorBloc.state.status).toBe("loaded"));
      });
    });
  });

  describe("with failing service", () => {
    let bloc: AirQualityBloc;

    beforeEach(() => {
      const failingService = new MockAirQualityService(mockResponse, true);
      bloc = new AirQualityBloc(failingService);
    });

    it("should transition to error state on failure", async () => {
      bloc.add({ type: "load" });

      await vi.waitFor(() => {
        expect(bloc.state.status).toBe("error");
      });

      if (bloc.state.status === "error") {
        expect(bloc.state.message).toBe("Mock error for testing");
      }
    });

    it("should go through loading before error", async () => {
      const states: string[] = [];
      bloc.subscribe((state) => states.push(state.status));

      bloc.add({ type: "load" });

      await vi.waitFor(() => expect(bloc.state.status).toBe("error"));

      expect(states[0]).toBe("loading");
      expect(states[1]).toBe("error");
    });
  });

  describe("clearError event", () => {
    it("should reset to initial state from error", async () => {
      const failingService = new MockAirQualityService(mockResponse, true);
      const bloc = new AirQualityBloc(failingService);

      // Get into error state
      bloc.add({ type: "load" });
      await vi.waitFor(() => expect(bloc.state.status).toBe("error"));

      // Clear error
      bloc.add({ type: "clearError" });

      expect(bloc.state.status).toBe("initial");
    });

    it("should do nothing if not in error state", async () => {
      const bloc = new AirQualityBloc(new MockAirQualityService(mockResponse));

      bloc.add({ type: "load" });
      await vi.waitFor(() => expect(bloc.state.status).toBe("loaded"));

      const stateBefore = bloc.state;
      bloc.add({ type: "clearError" });

      expect(bloc.state).toBe(stateBefore);
    });
  });

  describe("custom service injection", () => {
    it("should accept any implementation of AirQualityService", async () => {
      // Create a completely custom implementation inline
      const customService: AirQualityService = {
        fetchMeasurements: async () => ({
          lastUpdated: new Date().toISOString(),
          source: "Custom Service",
          measurements: [
            { id: 99, position: [0, 0], aqi: 100, location: "Custom" },
          ],
        }),
      };

      const bloc = new AirQualityBloc(customService);
      bloc.add({ type: "load" });

      await vi.waitFor(() => expect(bloc.state.status).toBe("loaded"));

      if (bloc.state.status === "loaded") {
        expect(bloc.state.source).toBe("Custom Service");
        expect(bloc.state.data[0]!.id).toBe(99);
      }
    });
  });

  /**
   * Bloc-to-Bloc Communication Tests
   *
   * Demonstrates testing the coordination between AirQualityBloc and MapBloc.
   * Key aspects:
   * - Subscription is set up via connectToMap()
   * - Debouncing prevents reload spam during continuous pan gestures
   * - Threshold prevents reload when movement is small
   */
  describe("bloc-to-bloc communication", () => {
    let airQualityBloc: AirQualityBloc;
    let mapBloc: MapBloc;
    let mockService: MockAirQualityService;

    beforeEach(() => {
      vi.useFakeTimers();
      mockService = new MockAirQualityService(mockResponse);
      airQualityBloc = new AirQualityBloc(mockService);
      mapBloc = new MapBloc();
    });

    afterEach(() => {
      airQualityBloc.dispose();
      vi.useRealTimers();
    });

    it("should not reload for small movements (under threshold)", () => {
      const fetchSpy = vi.spyOn(mockService, "fetchMeasurements");

      // Map starts at SF: -122.4194, 37.7749
      airQualityBloc.connectToMap(mapBloc);

      // Dispatch a small movement (under threshold of 0.05 degrees)
      mapBloc.add({
        type: "setCenter",
        longitude: -122.42,
        latitude: 37.78,
      });

      // Advance debounce timer
      vi.advanceTimersByTime(600);

      // Should NOT have reloaded (movement too small)
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should reload when viewport moves beyond threshold", async () => {
      vi.useRealTimers(); // Need real timers for async
      airQualityBloc.connectToMap(mapBloc);

      const fetchSpy = vi.spyOn(mockService, "fetchMeasurements");

      // Move significantly (> 0.05 degrees)
      mapBloc.add({
        type: "setCenter",
        longitude: -122.5, // ~0.08 degrees from initial
        latitude: 37.7749,
      });

      // Wait for debounce + async load
      await vi.waitFor(
        () => {
          expect(fetchSpy).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );
    });

    it("should debounce rapid viewport changes", () => {
      const fetchSpy = vi.spyOn(mockService, "fetchMeasurements");

      airQualityBloc.connectToMap(mapBloc);

      // Simulate rapid panning (multiple events in quick succession)
      // All movements are beyond threshold (> 0.05 from initial -122.4194)
      for (let i = 0; i < 10; i++) {
        mapBloc.add({
          type: "setCenter",
          longitude: -122.5 - i * 0.01, // Moving further west each time
          latitude: 37.7749,
        });
        vi.advanceTimersByTime(100); // Less than debounce threshold (500ms)
      }

      // Service should NOT have been called yet (still debouncing)
      expect(fetchSpy).not.toHaveBeenCalled();

      // Advance past debounce threshold
      vi.advanceTimersByTime(500);

      // Now it should have been called exactly once
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("should clean up subscriptions on dispose", () => {
      airQualityBloc.connectToMap(mapBloc);
      airQualityBloc.dispose();

      const fetchSpy = vi.spyOn(mockService, "fetchMeasurements");

      // Move map significantly
      mapBloc.add({
        type: "setCenter",
        longitude: -123.0,
        latitude: 37.7749,
      });

      vi.advanceTimersByTime(1000);

      // Should NOT reload after dispose
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
