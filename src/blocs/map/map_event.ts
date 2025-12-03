import type { MapViewState } from "@deck.gl/core";

/**
 * Map events using discriminated union pattern.
 *
 * Each event has a 'type' discriminator that TypeScript uses
 * for exhaustive matching in switch statements.
 */
export type MapEvent =
  | { type: "viewStateChanged"; viewState: MapViewState }
  | { type: "setCenter"; longitude: number; latitude: number }
  | { type: "setZoom"; zoom: number }
  | { type: "flyTo"; longitude: number; latitude: number; zoom?: number }
  | { type: "toggleLayer"; layerId: string }
  | { type: "reset" };
