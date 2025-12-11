import { useState, useCallback } from "react";
import { MultiBlocProvider } from "@granite-crisp/react-bloc";
import { AirQualityBloc, AirQualityBlocProvider } from "./blocs/air_quality";
import { ForestLossBloc, ForestLossBlocProvider } from "./blocs/forest_loss";
import { MapBloc, MapBlocProvider } from "./blocs/map";
import { Sf311Bloc, Sf311BlocProvider } from "./blocs/sf311";
import { ControlPanel } from "./components/ControlPanel";
import { ForestLossControlPanel } from "./components/ForestLossControlPanel";
import { ForestLossMap, type CompactionStats } from "./components/ForestLossMap";
import { MapView } from "./components/Map";

// Existing blocs for SF Bay Area view
const mapBloc = new MapBloc();
const airQualityBloc = new AirQualityBloc();
const sf311Bloc = new Sf311Bloc();

// Wire up bloc-to-bloc communication
// AirQualityBloc will reload data when map viewport changes significantly
airQualityBloc.connectToMap(mapBloc);

// New bloc for forest loss H3 visualization
const forestLossBloc = new ForestLossBloc();

type ViewMode = "sf" | "forest-loss";

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("sf");
  const [forestLossOpacity, setForestLossOpacity] = useState(0.8);
  const [useCompactView, setUseCompactView] = useState(false);
  const [compactionStats, setCompactionStats] = useState<CompactionStats | null>(null);

  const handleCompactionStatsChange = useCallback((stats: CompactionStats | null) => {
    setCompactionStats(stats);
  }, []);

  return (
    <MultiBlocProvider
      blocs={[
        { Provider: MapBlocProvider, bloc: mapBloc },
        { Provider: AirQualityBlocProvider, bloc: airQualityBloc },
        { Provider: Sf311BlocProvider, bloc: sf311Bloc },
        { Provider: ForestLossBlocProvider, bloc: forestLossBloc },
      ]}
    >
      <div className="w-full h-full relative">
        {/* View Switcher */}
        <div className="absolute top-4 right-4 z-10 bg-gray-900/90 backdrop-blur-sm rounded-lg p-1 flex gap-1">
          <button
            onClick={() => setViewMode("sf")}
            className={`px-4 py-2 text-sm rounded transition-colors ${
              viewMode === "sf"
                ? "bg-blue-600 text-white"
                : "bg-transparent text-gray-300 hover:bg-gray-700"
            }`}
          >
            SF Bay Area
          </button>
          <button
            onClick={() => setViewMode("forest-loss")}
            className={`px-4 py-2 text-sm rounded transition-colors ${
              viewMode === "forest-loss"
                ? "bg-blue-600 text-white"
                : "bg-transparent text-gray-300 hover:bg-gray-700"
            }`}
          >
            PNW Forest Loss (H3)
          </button>
        </div>

        {/* Conditional View Rendering */}
        {viewMode === "sf" ? (
          <>
            <MapView />
            <ControlPanel />
          </>
        ) : (
          <>
            <ForestLossMap
              opacity={forestLossOpacity}
              useCompactView={useCompactView}
              onCompactionStatsChange={handleCompactionStatsChange}
            />
            <ForestLossControlPanel
              opacity={forestLossOpacity}
              onOpacityChange={setForestLossOpacity}
              useCompactView={useCompactView}
              onCompactViewChange={setUseCompactView}
              compactionStats={compactionStats}
            />
          </>
        )}
      </div>
    </MultiBlocProvider>
  );
}
