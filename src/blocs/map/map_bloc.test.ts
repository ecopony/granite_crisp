import { describe, it, expect, beforeEach, vi } from "vitest";
import { MapBloc } from "./map_bloc";
import { initialMapState } from "./map_state";

/**
 * MapBloc Tests
 *
 * Key demonstration: Blocs are testable WITHOUT React.
 * - No React Testing Library needed
 * - No DOM, no jsdom
 * - Just instantiate the class and test its behavior
 *
 * This is a major advantage of the BLoC pattern — your business logic
 * is completely decoupled from the UI framework.
 */
describe("MapBloc", () => {
  let bloc: MapBloc;

  beforeEach(() => {
    // Fresh bloc for each test - no shared state between tests
    bloc = new MapBloc();
  });

  describe("initial state", () => {
    it("should start with the initial map state", () => {
      expect(bloc.state).toEqual(initialMapState);
    });

    it("should have San Francisco as the default center", () => {
      expect(bloc.state.viewState.longitude).toBeCloseTo(-122.4194, 4);
      expect(bloc.state.viewState.latitude).toBeCloseTo(37.7749, 4);
    });

    it("should have scatterplot layer enabled by default", () => {
      expect(bloc.state.enabledLayers.has("scatterplot")).toBe(true);
    });
  });

  describe("viewStateChanged event", () => {
    it("should update the view state", () => {
      const newViewState = {
        longitude: -73.9857,
        latitude: 40.7484,
        zoom: 14,
        pitch: 45,
        bearing: 90,
      };

      bloc.add({ type: "viewStateChanged", viewState: newViewState });

      expect(bloc.state.viewState).toEqual(newViewState);
    });

    it("should set isAnimating to false", () => {
      // First trigger an animation
      bloc.add({ type: "flyTo", longitude: 0, latitude: 0 });
      expect(bloc.state.isAnimating).toBe(true);

      // Then update view state (as happens during/after animation)
      bloc.add({
        type: "viewStateChanged",
        viewState: { ...bloc.state.viewState },
      });
      expect(bloc.state.isAnimating).toBe(false);
    });
  });

  describe("setCenter event", () => {
    it("should update longitude and latitude", () => {
      bloc.add({ type: "setCenter", longitude: -118.2437, latitude: 34.0522 });

      expect(bloc.state.viewState.longitude).toBe(-118.2437);
      expect(bloc.state.viewState.latitude).toBe(34.0522);
    });

    it("should preserve other view state properties", () => {
      const originalZoom = bloc.state.viewState.zoom;
      const originalPitch = bloc.state.viewState.pitch;

      bloc.add({ type: "setCenter", longitude: 0, latitude: 0 });

      expect(bloc.state.viewState.zoom).toBe(originalZoom);
      expect(bloc.state.viewState.pitch).toBe(originalPitch);
    });
  });

  describe("setZoom event", () => {
    it("should update the zoom level", () => {
      bloc.add({ type: "setZoom", zoom: 15 });

      expect(bloc.state.viewState.zoom).toBe(15);
    });

    it("should preserve position", () => {
      const originalLng = bloc.state.viewState.longitude;
      const originalLat = bloc.state.viewState.latitude;

      bloc.add({ type: "setZoom", zoom: 5 });

      expect(bloc.state.viewState.longitude).toBe(originalLng);
      expect(bloc.state.viewState.latitude).toBe(originalLat);
    });
  });

  describe("flyTo event", () => {
    it("should update position and set isAnimating to true", () => {
      bloc.add({ type: "flyTo", longitude: 139.6917, latitude: 35.6895 });

      expect(bloc.state.viewState.longitude).toBe(139.6917);
      expect(bloc.state.viewState.latitude).toBe(35.6895);
      expect(bloc.state.isAnimating).toBe(true);
    });

    it("should update zoom if provided", () => {
      bloc.add({
        type: "flyTo",
        longitude: 2.3522,
        latitude: 48.8566,
        zoom: 13,
      });

      expect(bloc.state.viewState.zoom).toBe(13);
    });

    it("should keep current zoom if not provided", () => {
      const originalZoom = bloc.state.viewState.zoom;

      bloc.add({ type: "flyTo", longitude: 0, latitude: 0 });

      expect(bloc.state.viewState.zoom).toBe(originalZoom);
    });
  });

  describe("toggleLayer event", () => {
    it("should disable an enabled layer", () => {
      expect(bloc.state.enabledLayers.has("scatterplot")).toBe(true);

      bloc.add({ type: "toggleLayer", layerId: "scatterplot" });

      expect(bloc.state.enabledLayers.has("scatterplot")).toBe(false);
    });

    it("should enable a disabled layer", () => {
      // First disable it
      bloc.add({ type: "toggleLayer", layerId: "scatterplot" });
      expect(bloc.state.enabledLayers.has("scatterplot")).toBe(false);

      // Then enable it again
      bloc.add({ type: "toggleLayer", layerId: "scatterplot" });
      expect(bloc.state.enabledLayers.has("scatterplot")).toBe(true);
    });

    it("should add a new layer that was not in the initial set", () => {
      bloc.add({ type: "toggleLayer", layerId: "heatmap" });

      expect(bloc.state.enabledLayers.has("heatmap")).toBe(true);
    });
  });

  describe("reset event", () => {
    it("should restore the initial state", () => {
      // Make several changes
      bloc.add({ type: "setCenter", longitude: 100, latitude: 50 });
      bloc.add({ type: "setZoom", zoom: 20 });
      bloc.add({ type: "toggleLayer", layerId: "scatterplot" });

      // Reset
      bloc.add({ type: "reset" });

      expect(bloc.state).toEqual(initialMapState);
    });
  });

  describe("subscriptions", () => {
    it("should notify subscribers when state changes", () => {
      const listener = vi.fn();
      bloc.subscribe(listener);

      bloc.add({ type: "setZoom", zoom: 8 });

      expect(listener).toHaveBeenCalledTimes(1);
      // Zustand calls subscribers with (newState, prevState)
      const [newState] = listener.mock.calls[0]!;
      expect(newState.viewState.zoom).toBe(8);
    });

    it("should allow unsubscribing", () => {
      const listener = vi.fn();
      const unsubscribe = bloc.subscribe(listener);

      bloc.add({ type: "setZoom", zoom: 8 });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      bloc.add({ type: "setZoom", zoom: 10 });
      // Still only called once - the second event was not received
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
