import { useMapBloc, useMapBlocState } from "../blocs/map";
import { useAirQualityBlocState } from "../blocs/air_quality";
import { useSf311BlocState } from "../blocs/sf311";

const LOCATIONS = [
  { name: "San Francisco", lng: -122.4194, lat: 37.7749, zoom: 12 },
  { name: "Oakland", lng: -122.2711, lat: 37.8044, zoom: 12 },
  { name: "Bay Area", lng: -122.2, lat: 37.6, zoom: 9 },
];

/**
 * Renders the data status based on the current AirQualityBloc state.
 * Demonstrates exhaustive pattern matching on union state types.
 */
function AirQualityDataStatus() {
  const state = useAirQualityBlocState();

  switch (state.status) {
    case "initial":
      return <span className="text-gray-400">Not loaded</span>;

    case "loading":
      return <span className="text-blue-400 animate-pulse">Loading...</span>;

    case "loaded":
      return <span className="text-green-400">{state.data.length} points</span>;

    case "error":
      return (
        <span className="text-red-400" title={state.message}>
          Error
        </span>
      );
  }
}

/**
 * Renders the SF 311 data status.
 */
function Sf311DataStatus() {
  const state = useSf311BlocState();

  switch (state.status) {
    case "initial":
      return <span className="text-gray-400">Not loaded</span>;

    case "loading":
      return <span className="text-blue-400 animate-pulse">Loading...</span>;

    case "loaded":
      return (
        <span className="text-green-400">
          {state.count.toLocaleString()} requests
        </span>
      );

    case "error":
      return (
        <span className="text-red-400" title={state.message}>
          Error
        </span>
      );
  }
}

export function ControlPanel() {
  // Get blocs from context for dispatching events
  const mapBloc = useMapBloc();

  // Subscribe to state for rendering
  const { viewState, enabledLayers } = useMapBlocState();

  return (
    <div className="absolute top-4 left-4 bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 text-white shadow-xl min-w-[220px]">
      <h2 className="text-lg font-semibold mb-3">SF Visualization</h2>

      {/* View State Info */}
      <div className="text-xs text-gray-400 mb-4 font-mono">
        <div>lng: {viewState.longitude.toFixed(4)}</div>
        <div>lat: {viewState.latitude.toFixed(4)}</div>
        <div>
          zoom: {viewState.zoom.toFixed(2)} | pitch:{" "}
          {viewState.pitch?.toFixed(0) ?? 0}
        </div>
      </div>

      {/* Data Status - demonstrates async state handling */}
      <div className="mb-4 pb-3 border-b border-gray-700">
        <h3 className="text-sm font-medium text-gray-300 mb-2">Data Sources</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Air Quality:</span>
            <AirQualityDataStatus />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">SF 311:</span>
            <Sf311DataStatus />
          </div>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-300 mb-2">Fly To</h3>
        <div className="flex flex-col gap-1">
          {LOCATIONS.map((loc) => (
            <button
              key={loc.name}
              onClick={() =>
                mapBloc.add({
                  type: "flyTo",
                  longitude: loc.lng,
                  latitude: loc.lat,
                  zoom: loc.zoom,
                })
              }
              className="text-left px-2 py-1 text-sm rounded hover:bg-gray-700 transition-colors"
            >
              {loc.name}
            </button>
          ))}
        </div>
      </div>

      {/* Layer Toggles */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-300 mb-2">Layers</h3>
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabledLayers.has("scatterplot")}
              onChange={() =>
                mapBloc.add({ type: "toggleLayer", layerId: "scatterplot" })
              }
              className="rounded"
            />
            <span className="text-sm">AQI Points</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabledLayers.has("hexagon")}
              onChange={() =>
                mapBloc.add({ type: "toggleLayer", layerId: "hexagon" })
              }
              className="rounded"
            />
            <span className="text-sm">311 Hexagons</span>
            <span className="text-xs text-gray-500">(3D)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabledLayers.has("heatmap")}
              onChange={() =>
                mapBloc.add({ type: "toggleLayer", layerId: "heatmap" })
              }
              className="rounded"
            />
            <span className="text-sm">311 Heatmap</span>
          </label>
        </div>
      </div>

      {/* Reset Button */}
      <button
        onClick={() => mapBloc.add({ type: "reset" })}
        className="w-full px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
      >
        Reset View
      </button>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-gray-700">
        <h3 className="text-sm font-medium text-gray-300 mb-2">AQI Legend</h3>
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span>Good (0-50)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
            <span>Moderate (51-100)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500"></span>
            <span>Sensitive (101-150)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span>Unhealthy (151+)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
