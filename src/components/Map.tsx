import { useCallback, useEffect } from "react";
import { Map as MapLibreMap } from "react-map-gl/maplibre";
import DeckGL from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import type { MapViewState, PickingInfo } from "@deck.gl/core";
import { useMapBloc, useMapBlocState } from "../blocs/map";
import {
  useAirQualityBloc,
  useAirQualityBlocState,
  type AirQualityPoint,
} from "../blocs/air_quality";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * Get color based on AQI value (EPA color scale)
 * Green (good) -> Yellow -> Orange -> Red (unhealthy)
 */
function getAqiColor(aqi: number): [number, number, number, number] {
  if (aqi <= 50) return [0, 228, 0, 200]; // Good - Green
  if (aqi <= 100) return [255, 255, 0, 200]; // Moderate - Yellow
  if (aqi <= 150) return [255, 126, 0, 200]; // Unhealthy for Sensitive - Orange
  return [255, 0, 0, 200]; // Unhealthy - Red
}

export function MapView() {
  // Get blocs from context - no more direct singleton imports
  const mapBloc = useMapBloc();
  const airQualityBloc = useAirQualityBloc();

  // Subscribe to state changes
  const { viewState, enabledLayers } = useMapBlocState();
  const airQualityState = useAirQualityBlocState();

  // Trigger data load on mount
  useEffect(() => {
    airQualityBloc.add({ type: "load" });
  }, [airQualityBloc]);

  // Extract data from loaded state (empty array otherwise)
  const airQualityData =
    airQualityState.status === "loaded" ? airQualityState.data : [];

  const handleViewStateChange = useCallback(
    // deck.gl's generic typing for view state is complex; we know we're using MapViewState
    (params: { viewState: MapViewState }) => {
      mapBloc.add({ type: "viewStateChanged", viewState: params.viewState });
    },
    [mapBloc]
  );

  const onClick = useCallback((info: PickingInfo) => {
    if (info.object) {
      const point = info.object as AirQualityPoint;
      console.log("Clicked:", point.location, "AQI:", point.aqi);
    }
  }, []);

  const layers = [
    enabledLayers.has("scatterplot") &&
      new ScatterplotLayer<AirQualityPoint>({
        id: "air-quality-points",
        data: airQualityData,
        getPosition: (d) => d.position,
        getRadius: (d) => 100 + d.aqi * 3,
        getFillColor: (d) => getAqiColor(d.aqi),
        pickable: true,
        opacity: 0.8,
        stroked: true,
        lineWidthMinPixels: 2,
        getLineColor: [255, 255, 255, 150],
        radiusScale: 1,
        radiusMinPixels: 10,
        radiusMaxPixels: 100,
      }),
  ].filter(Boolean);

  return (
    <DeckGL
      viewState={viewState}
      // @ts-expect-error - deck.gl's ViewStateChangeParameters generic is overly complex
      onViewStateChange={handleViewStateChange}
      controller={true}
      layers={layers}
      onClick={onClick}
      getTooltip={({ object }) =>
        object && {
          html: `<div class="p-2">
            <strong>${(object as AirQualityPoint).location}</strong><br/>
            AQI: ${(object as AirQualityPoint).aqi}
          </div>`,
          style: {
            backgroundColor: "#1f2937",
            color: "white",
            fontSize: "12px",
            borderRadius: "4px",
          },
        }
      }
    >
      <MapLibreMap
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        attributionControl={false}
      />
    </DeckGL>
  );
}
