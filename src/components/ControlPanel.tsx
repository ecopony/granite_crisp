import { useMapBloc, useMapBlocState } from '../blocs/map'
import { useAirQualityBloc, useAirQualityBlocState } from '../blocs/air_quality'

const LOCATIONS = [
  { name: 'San Francisco', lng: -122.4194, lat: 37.7749, zoom: 12 },
  { name: 'Oakland', lng: -122.2711, lat: 37.8044, zoom: 12 },
  { name: 'Bay Area', lng: -122.2, lat: 37.6, zoom: 9 },
]

/**
 * Renders the data status based on the current AirQualityBloc state.
 * Demonstrates exhaustive pattern matching on union state types.
 */
function DataStatus() {
  const state = useAirQualityBlocState()

  switch (state.status) {
    case 'initial':
      return <span className="text-gray-400">Not loaded</span>

    case 'loading':
      return (
        <span className="text-blue-400 animate-pulse">
          Loading...
        </span>
      )

    case 'loaded':
      return (
        <span className="text-green-400">
          {state.data.length} points loaded
        </span>
      )

    case 'error':
      return (
        <span className="text-red-400" title={state.message}>
          Error loading data
        </span>
      )
  }
}

export function ControlPanel() {
  // Get blocs from context for dispatching events
  const mapBloc = useMapBloc()
  const airQualityBloc = useAirQualityBloc()

  // Subscribe to state for rendering
  const { viewState, enabledLayers } = useMapBlocState()
  const airQualityState = useAirQualityBlocState()

  return (
    <div className="absolute top-4 left-4 bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 text-white shadow-xl min-w-[200px]">
      <h2 className="text-lg font-semibold mb-3">Air Quality Map</h2>

      {/* View State Info */}
      <div className="text-xs text-gray-400 mb-4 font-mono">
        <div>lng: {viewState.longitude.toFixed(4)}</div>
        <div>lat: {viewState.latitude.toFixed(4)}</div>
        <div>zoom: {viewState.zoom.toFixed(2)}</div>
      </div>

      {/* Data Status - demonstrates async state handling */}
      <div className="mb-4 pb-3 border-b border-gray-700">
        <h3 className="text-sm font-medium text-gray-300 mb-2">Data</h3>
        <div className="flex items-center justify-between">
          <div className="text-xs">
            <DataStatus />
          </div>
          <button
            onClick={() => airQualityBloc.add({ type: 'refresh' })}
            disabled={airQualityState.status === 'loading'}
            className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors"
          >
            {airQualityState.status === 'loading' ? '...' : 'Refresh'}
          </button>
        </div>
        {airQualityState.status === 'loaded' && (
          <div className="text-xs text-gray-500 mt-1">
            Source: {airQualityState.source}
          </div>
        )}
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
                  type: 'flyTo',
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
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabledLayers.has('scatterplot')}
            onChange={() => mapBloc.add({ type: 'toggleLayer', layerId: 'scatterplot' })}
            className="rounded"
          />
          <span className="text-sm">AQI Points</span>
        </label>
      </div>

      {/* Reset Button */}
      <button
        onClick={() => mapBloc.add({ type: 'reset' })}
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
  )
}
