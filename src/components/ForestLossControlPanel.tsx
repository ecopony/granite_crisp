import { useState, useEffect, useRef, useCallback } from "react";
import {
  useForestLossBloc,
  useForestLossBlocState,
} from "../blocs/forest_loss";
import { LOSS_COLOR_SCALE, rgbaToHex, type CompactionStats } from "./ForestLossMap";

// Year range constants (internal format: 1-23 = 2001-2023)
const MIN_YEAR = 1;
const MAX_YEAR = 23;

type ForestLossControlPanelProps = {
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  useCompactView: boolean;
  onCompactViewChange: (useCompact: boolean) => void;
  compactionStats: CompactionStats | null;
};

/**
 * Control panel for the Forest Loss visualization
 *
 * Displays:
 * - Current status and resolution
 * - Year stepper (single year navigation)
 * - Year range filter
 * - Opacity control
 * - Color legend
 */
export function ForestLossControlPanel({
  opacity,
  onOpacityChange,
  useCompactView,
  onCompactViewChange,
  compactionStats,
}: ForestLossControlPanelProps) {
  const forestLossBloc = useForestLossBloc();
  const state = useForestLossBlocState();

  // Derive year filter values from BLoC state (single source of truth)
  const yearFilter =
    state.status === "loaded" ? state.yearFilter : { minYear: null, maxYear: null };
  const isSingleYearMode =
    yearFilter.minYear !== null &&
    yearFilter.minYear === yearFilter.maxYear;
  const singleYear = isSingleYearMode ? yearFilter.minYear : null;

  // Local UI state only for range filter inputs (not the actual filter)
  const [rangeMinInput, setRangeMinInput] = useState<string>("");
  const [rangeMaxInput, setRangeMaxInput] = useState<string>("");
  const [showRangeFilter, setShowRangeFilter] = useState(false);

  // Animation state
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(500); // ms per frame
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if currently loading
  const isLoading = state.status === "loading";

  // Animation logic
  const advanceYear = useCallback(() => {
    const currentYear = singleYear ?? MIN_YEAR - 1;
    const nextYear = currentYear >= MAX_YEAR ? MIN_YEAR : currentYear + 1;
    forestLossBloc.add({
      type: "setYearFilter",
      minYear: nextYear,
      maxYear: nextYear,
    });
  }, [singleYear, forestLossBloc]);

  // Start/stop animation
  const toggleAnimation = useCallback(() => {
    if (isAnimating) {
      // Stop animation
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
      setIsAnimating(false);
    } else {
      // Start animation - set initial year if needed
      if (singleYear === null) {
        forestLossBloc.add({
          type: "setYearFilter",
          minYear: MIN_YEAR,
          maxYear: MIN_YEAR,
        });
      }
      setIsAnimating(true);
    }
  }, [isAnimating, singleYear, forestLossBloc]);

  // Handle animation interval
  useEffect(() => {
    if (isAnimating) {
      animationRef.current = setInterval(advanceYear, animationSpeed);
    }
    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isAnimating, animationSpeed, advanceYear]);

  // Stop animation when component unmounts or loading starts
  useEffect(() => {
    if (isLoading && isAnimating) {
      setIsAnimating(false);
    }
  }, [isLoading, isAnimating]);

  // Convert internal year (1-23) to display year (2001-2023)
  const toDisplayYear = (year: number) => 2000 + year;

  // Set single year filter (applies immediately)
  const setYearAndApply = (year: number | null) => {
    if (year === null) {
      forestLossBloc.add({ type: "clearYearFilter" });
    } else {
      forestLossBloc.add({
        type: "setYearFilter",
        minYear: year,
        maxYear: year,
      });
    }
  };

  const handlePrevYear = () => {
    if (singleYear === null) {
      setYearAndApply(MAX_YEAR);
    } else if (singleYear > MIN_YEAR) {
      setYearAndApply(singleYear - 1);
    }
  };

  const handleNextYear = () => {
    if (singleYear === null) {
      setYearAndApply(MIN_YEAR);
    } else if (singleYear < MAX_YEAR) {
      setYearAndApply(singleYear + 1);
    }
  };

  const handleApplyRangeFilter = () => {
    forestLossBloc.add({
      type: "setYearFilter",
      minYear: rangeMinInput ? parseInt(rangeMinInput) : null,
      maxYear: rangeMaxInput ? parseInt(rangeMaxInput) : null,
    });
  };

  const handleClearFilter = () => {
    setRangeMinInput("");
    setRangeMaxInput("");
    forestLossBloc.add({ type: "clearYearFilter" });
  };

  return (
    <div className="absolute top-4 left-4 bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 text-white shadow-xl min-w-[260px] max-w-[300px]">
      <h2 className="text-lg font-semibold mb-1">PNW Forest Loss</h2>
      <p className="text-xs text-gray-400 mb-3">Hansen Global Forest Change</p>

      {/* Status */}
      <div className="text-sm mb-4 p-2 bg-gray-800/50 rounded">
        {(() => {
          switch (state.status) {
            case "initial":
              return <span className="text-gray-400">Not loaded</span>;
            case "loading":
              return (
                <span className="text-blue-400 animate-pulse">
                  Loading resolution {state.resolution}...
                </span>
              );
            case "loaded":
              return (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cells:</span>
                    <span className="text-green-400 font-mono">
                      {state.data.length.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">H3 Resolution:</span>
                    <span className="text-cyan-400 font-mono">
                      {state.resolution}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Source:</span>
                    <span className="text-gray-300 text-xs">{state.source}</span>
                  </div>
                </div>
              );
            case "error":
              return <span className="text-red-400">{state.message}</span>;
            default: {
              const _exhaustive: never = state;
              return _exhaustive;
            }
          }
        })()}
      </div>

      {/* Year Stepper - Quick single year navigation */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-300 mb-2">Year</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevYear}
            disabled={isLoading || singleYear === MIN_YEAR}
            className="px-3 py-2 text-lg bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed rounded transition-colors"
            title="Previous year"
          >
            ‹
          </button>
          <div className="flex-1 text-center">
            <span className="text-2xl font-mono font-bold text-cyan-400">
              {singleYear ? toDisplayYear(singleYear) : "All"}
            </span>
          </div>
          <button
            onClick={handleNextYear}
            disabled={isLoading || singleYear === MAX_YEAR}
            className="px-3 py-2 text-lg bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed rounded transition-colors"
            title="Next year"
          >
            ›
          </button>
        </div>
        {/* Animation Controls */}
        <div className="flex items-center justify-center gap-2 mt-3 mb-2">
          <button
            onClick={toggleAnimation}
            disabled={isLoading}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded transition-colors disabled:cursor-not-allowed ${
              isAnimating
                ? "bg-red-600 hover:bg-red-500 text-white"
                : "bg-green-600 hover:bg-green-500 text-white disabled:bg-gray-700 disabled:text-gray-500"
            }`}
          >
            {isAnimating ? (
              <>
                <span className="text-xs">■</span> Stop
              </>
            ) : (
              <>
                <span className="text-xs">▶</span> Play
              </>
            )}
          </button>
          <select
            value={animationSpeed}
            onChange={(e) => setAnimationSpeed(Number(e.target.value))}
            disabled={isLoading}
            className="px-2 py-1.5 text-xs bg-gray-700 border border-gray-600 rounded text-gray-300 disabled:bg-gray-800 disabled:text-gray-600"
          >
            <option value={1000}>Slow</option>
            <option value={500}>Normal</option>
            <option value={250}>Fast</option>
            <option value={100}>Very Fast</option>
          </select>
        </div>

        <div className="flex justify-center gap-2 mt-2">
          <button
            onClick={() => {
              if (isAnimating) toggleAnimation();
              setYearAndApply(null);
            }}
            disabled={isLoading}
            className={`px-3 py-1 text-xs rounded transition-colors disabled:cursor-not-allowed ${
              singleYear === null && !isLoading
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600"
            }`}
          >
            Show All
          </button>
          <button
            onClick={() => setShowRangeFilter(!showRangeFilter)}
            disabled={isLoading}
            className="px-3 py-1 text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed rounded transition-colors"
          >
            {showRangeFilter ? "Hide Range" : "Range Filter"}
          </button>
        </div>
      </div>

      {/* Collapsible Range Filter */}
      {showRangeFilter && (
        <div className="mb-4 p-3 bg-gray-800/50 rounded">
          <h4 className="text-xs font-medium text-gray-400 mb-2">
            Year Range
          </h4>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="number"
              placeholder="2001"
              min="2001"
              max="2023"
              disabled={isLoading}
              value={rangeMinInput ? toDisplayYear(parseInt(rangeMinInput)).toString() : ""}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val >= 2001 && val <= 2023) {
                  setRangeMinInput((val - 2000).toString());
                } else if (e.target.value === "") {
                  setRangeMinInput("");
                }
              }}
              className="w-20 px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded focus:border-blue-500 focus:outline-none disabled:bg-gray-900 disabled:text-gray-600"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="number"
              placeholder="2023"
              min="2001"
              max="2023"
              disabled={isLoading}
              value={rangeMaxInput ? toDisplayYear(parseInt(rangeMaxInput)).toString() : ""}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val >= 2001 && val <= 2023) {
                  setRangeMaxInput((val - 2000).toString());
                } else if (e.target.value === "") {
                  setRangeMaxInput("");
                }
              }}
              className="w-20 px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded focus:border-blue-500 focus:outline-none disabled:bg-gray-900 disabled:text-gray-600"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleApplyRangeFilter}
              disabled={isLoading || (!rangeMinInput && !rangeMaxInput)}
              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded transition-colors"
            >
              Apply Range
            </button>
            <button
              onClick={handleClearFilter}
              disabled={isLoading}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed rounded transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Opacity Control */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium text-gray-300">Opacity</h3>
          <span className="text-xs text-gray-400 font-mono">
            {Math.round(opacity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={opacity * 100}
          onChange={(e) => onOpacityChange(parseInt(e.target.value) / 100)}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      {/* H3 Compact View Toggle */}
      <div className="mb-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={useCompactView}
              onChange={(e) => onCompactViewChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-gray-700 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-300">Compact View</span>
            <p className="text-xs text-gray-500">Use h3.compactCells()</p>
          </div>
        </label>
        {/* Compaction Stats */}
        {compactionStats && (
          <div className="mt-2 ml-13 p-2 bg-gray-800/50 rounded text-xs">
            <div className="flex justify-between text-gray-400">
              <span>Original:</span>
              <span className="font-mono">{compactionStats.original.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Compacted:</span>
              <span className="font-mono text-green-400">{compactionStats.compacted.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Reduction:</span>
              <span className="font-mono text-cyan-400">{compactionStats.reduction}%</span>
            </div>
          </div>
        )}
      </div>

      {/* H3 Resolution Info */}
      <div className="mb-4 text-xs text-gray-400">
        <h3 className="text-sm font-medium text-gray-300 mb-2">
          Resolution Guide
        </h3>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Res 4:</span>
            <span>~1,770 km² per hex</span>
          </div>
          <div className="flex justify-between">
            <span>Res 5:</span>
            <span>~253 km² per hex</span>
          </div>
          <div className="flex justify-between">
            <span>Res 6:</span>
            <span>~36 km² per hex</span>
          </div>
          <div className="flex justify-between">
            <span>Res 7:</span>
            <span>~5 km² per hex</span>
          </div>
        </div>
        <p className="mt-2 text-gray-500">
          Zoom in/out to change resolution automatically
        </p>
      </div>

      {/* Legend */}
      <div className="pt-3 border-t border-gray-700">
        <h3 className="text-sm font-medium text-gray-300 mb-2">
          Loss Intensity
        </h3>
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded" style={{ backgroundColor: rgbaToHex(LOSS_COLOR_SCALE.low) }}></span>
            <span>Low</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded" style={{ backgroundColor: rgbaToHex(LOSS_COLOR_SCALE.medium) }}></span>
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded" style={{ backgroundColor: rgbaToHex(LOSS_COLOR_SCALE.high) }}></span>
            <span>High</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded" style={{ backgroundColor: rgbaToHex(LOSS_COLOR_SCALE.veryHigh) }}></span>
            <span>Very High</span>
          </div>
        </div>
      </div>
    </div>
  );
}
