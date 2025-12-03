import type { MapViewState } from "@deck.gl/core";

export type MapState = {
  viewState: MapViewState;
  enabledLayers: Set<string>;
  isAnimating: boolean;
};

// Default view centered on San Francisco
// Pitch of 45 gives a nice 3D view for the HexagonLayer
export const initialMapState: MapState = {
  viewState: {
    longitude: -122.4194,
    latitude: 37.7749,
    zoom: 11,
    pitch: 45,
    bearing: 0,
  },
  enabledLayers: new Set(["scatterplot", "hexagon"]),
  isAnimating: false,
};
