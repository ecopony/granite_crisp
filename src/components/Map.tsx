import { HeatmapLayer, HexagonLayer } from "@deck.gl/aggregation-layers";
import type { MapViewState, PickingInfo } from "@deck.gl/core";
import { ScatterplotLayer } from "@deck.gl/layers";
import DeckGL from "@deck.gl/react";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect } from "react";
import { Map as MapLibreMap } from "react-map-gl/maplibre";
import {
  useAirQualityBloc,
  useAirQualityBlocState,
  type AirQualityPoint,
} from "../blocs/air_quality";
import { useMapBloc, useMapBlocState } from "../blocs/map";
import {
  useSf311Bloc,
  useSf311BlocState,
  type Sf311Request,
} from "../blocs/sf311";

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

/**
 * Color scale for HexagonLayer elevation
 * Purple -> Blue -> Cyan -> Green -> Yellow -> Orange -> Red
 */
const HEXAGON_COLOR_RANGE: [number, number, number][] = [
  [1, 152, 189],
  [73, 227, 206],
  [216, 254, 181],
  [254, 237, 177],
  [254, 173, 84],
  [209, 55, 78],
];

export function MapView() {
  // Get blocs from context - no more direct singleton imports
  const mapBloc = useMapBloc();
  const airQualityBloc = useAirQualityBloc();
  const sf311Bloc = useSf311Bloc();

  // Subscribe to state changes
  const { viewState, enabledLayers } = useMapBlocState();
  const airQualityState = useAirQualityBlocState();
  const sf311State = useSf311BlocState();

  // Trigger data load on mount
  useEffect(() => {
    airQualityBloc.add({ type: "load" });
    sf311Bloc.add({ type: "load" });
  }, [airQualityBloc, sf311Bloc]);

  // Extract data from loaded state (empty array otherwise)
  const airQualityData =
    airQualityState.status === "loaded" ? airQualityState.data : [];
  const sf311Data = sf311State.status === "loaded" ? sf311State.data : [];

  const handleViewStateChange = useCallback(
    // deck.gl's generic typing for view state is complex; we know we're using MapViewState
    (params: { viewState: MapViewState }) => {
      mapBloc.add({ type: "viewStateChanged", viewState: params.viewState });
    },
    [mapBloc]
  );

  const onClick = useCallback((info: PickingInfo) => {
    if (!info.object || !info.layer) return;

    switch (info.layer.id) {
      case "air-quality-points": {
        const point = info.object as AirQualityPoint;
        console.log("Clicked AQI:", point.location, "AQI:", point.aqi);
        break;
      }
      case "sf311-hexagon": {
        const hex = info.object as { points: Sf311Request[]; count: number };
        console.log("Clicked hexagon:", hex.count, "requests");
        break;
      }
    }
  }, []);

  const layers = [
    // Air Quality ScatterplotLayer
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

    // SF 311 HexagonLayer - GPU-aggregated hexagonal bins
    // Points are grouped into hexagons with height/color based on count
    enabledLayers.has("hexagon") &&
      new HexagonLayer<Sf311Request>({
        id: "sf311-hexagon",
        data: sf311Data,
        getPosition: (d) => d.position,
        radius: 200, // Hexagon radius in meters
        elevationScale: 4, // Height multiplier
        extruded: true, // Enable 3D extrusion
        pickable: true,
        colorRange: HEXAGON_COLOR_RANGE,
        coverage: 0.9, // Hexagon fill ratio (0.9 = small gaps between)
        upperPercentile: 95, // Cap outliers for better color distribution
        material: {
          ambient: 0.64,
          diffuse: 0.6,
          shininess: 32,
        },
      }),

    // SF 311 HeatmapLayer - Smooth density visualization
    // Creates a continuous gradient showing point concentration
    enabledLayers.has("heatmap") &&
      new HeatmapLayer<Sf311Request>({
        id: "sf311-heatmap",
        data: sf311Data,
        getPosition: (d) => d.position,
        getWeight: () => 1, // Each point contributes equally
        radiusPixels: 30, // Influence radius of each point
        intensity: 1, // Overall intensity multiplier
        threshold: 0.05, // Minimum value to render (reduces noise)
        colorRange: [
          [0, 0, 0, 0], // Transparent at low density
          [66, 135, 245, 150], // Blue
          [84, 214, 137, 180], // Green
          [252, 232, 58, 200], // Yellow
          [249, 136, 47, 220], // Orange
          [237, 45, 45, 255], // Red at high density
        ],
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
      getTooltip={({ object, layer }) => {
        if (!object || !layer) return null;

        const style = {
          backgroundColor: "#1f2937",
          color: "white",
          fontSize: "12px",
          borderRadius: "4px",
        };

        switch (layer.id) {
          case "air-quality-points": {
            const point = object as AirQualityPoint;
            return {
              html: `<div class="p-2">
                <strong>${point.location}</strong><br/>
                AQI: ${point.aqi}
              </div>`,
              style,
            };
          }
          case "sf311-hexagon": {
            const hex = object as { points: Sf311Request[]; count: number };
            return {
              html: `<div class="p-2">
                <strong>${hex.count} service requests</strong>
              </div>`,
              style,
            };
          }
          default:
            return null;
        }
      }}
    >
      <MapLibreMap
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        attributionControl={false}
      />
    </DeckGL>
  );
}
