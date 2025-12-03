import { Bloc } from "../base_bloc";
import type { MapEvent } from "./map_event";
import type { MapState } from "./map_state";
import { initialMapState } from "./map_state";

/**
 * MapBloc manages all map-related state and logic.
 *
 * This keeps map business logic (view transitions, layer toggling, etc.)
 * completely separate from React components. The map component becomes
 * a pure view that just renders based on state.
 */
export class MapBloc extends Bloc<MapEvent, MapState> {
  constructor() {
    super(initialMapState);
  }

  add(event: MapEvent): void {
    switch (event.type) {
      case "viewStateChanged":
        this.emit({
          viewState: event.viewState,
          isAnimating: false,
        });
        break;

      case "setCenter":
        this.emit({
          viewState: {
            ...this.state.viewState,
            longitude: event.longitude,
            latitude: event.latitude,
          },
        });
        break;

      case "setZoom":
        this.emit({
          viewState: {
            ...this.state.viewState,
            zoom: event.zoom,
          },
        });
        break;

      case "flyTo":
        // For animated transitions, we'd integrate with deck.gl's
        // FlyToInterpolator here. For now, just update immediately.
        this.emit({
          viewState: {
            ...this.state.viewState,
            longitude: event.longitude,
            latitude: event.latitude,
            zoom: event.zoom ?? this.state.viewState.zoom,
          },
          isAnimating: true,
        });
        break;

      case "toggleLayer": {
        const newLayers = new Set(this.state.enabledLayers);
        if (newLayers.has(event.layerId)) {
          newLayers.delete(event.layerId);
        } else {
          newLayers.add(event.layerId);
        }
        this.emit({ enabledLayers: newLayers });
        break;
      }

      case "reset":
        this.emit(initialMapState);
        break;
    }
  }
}
