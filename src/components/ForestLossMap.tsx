import type { MapViewState, PickingInfo } from "@deck.gl/core";
import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { PolygonLayer } from "@deck.gl/layers";
import DeckGL from "@deck.gl/react";
import * as h3 from "h3-js";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map as MapLibreMap } from "react-map-gl/maplibre";
import {
  useForestLossBloc,
  useForestLossBlocState,
  type ForestLossCell,
} from "../blocs/forest_loss";

/**
 * Pacific Northwest initial view state
 * Centered on Oregon/Washington border area
 */
const INITIAL_VIEW_STATE: MapViewState = {
  longitude: -122.5,
  latitude: 45.5,
  zoom: 6,
  pitch: 45,
  bearing: 0,
};

/**
 * Zoom-to-H3-resolution mapping
 * H3's hierarchical nature means higher resolutions = smaller hexagons
 *
 * Resolution | Avg Hex Area | Use Case
 * -----------|--------------|----------
 * 4          | ~1,770 km²   | Continental overview
 * 5          | ~253 km²     | Regional view
 * 6          | ~36 km²      | State/province level
 * 7          | ~5.2 km²     | Local detail
 */
const ZOOM_TO_RESOLUTION: Array<{ maxZoom: number; resolution: number }> = [
  { maxZoom: 5, resolution: 4 },
  { maxZoom: 7, resolution: 5 },
  { maxZoom: 9, resolution: 6 },
  { maxZoom: Infinity, resolution: 7 },
];

/** Debounce delay for resolution changes (ms) */
const RESOLUTION_CHANGE_DEBOUNCE_MS = 300;

function getResolutionForZoom(zoom: number): number {
  for (const { maxZoom, resolution } of ZOOM_TO_RESOLUTION) {
    if (zoom <= maxZoom) return resolution;
  }
  return 7;
}

/**
 * Color scale for forest loss intensity (RGBA)
 * Used by both the map layer and the legend in ForestLossControlPanel
 */
export const LOSS_COLOR_SCALE = {
  low: [255, 255, 0, 180] as [number, number, number, number], // Yellow
  medium: [255, 165, 0, 200] as [number, number, number, number], // Orange
  high: [255, 69, 0, 220] as [number, number, number, number], // Red-Orange
  veryHigh: [139, 0, 0, 255] as [number, number, number, number], // Dark Red
} as const;

/** Get CSS color string from RGBA array */
export function rgbaToHex(
  rgba: readonly [number, number, number, number]
): string {
  return `#${rgba
    .slice(0, 3)
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * Color scale for forest loss intensity
 * Yellow (low) -> Orange -> Red -> Dark Red (high)
 */
function getLossColor(
  totalLoss: number,
  maxLoss: number
): [number, number, number, number] {
  const normalized = Math.min(totalLoss / maxLoss, 1);

  if (normalized < 0.25) return LOSS_COLOR_SCALE.low;
  if (normalized < 0.5) return LOSS_COLOR_SCALE.medium;
  if (normalized < 0.75) return LOSS_COLOR_SCALE.high;
  return LOSS_COLOR_SCALE.veryHigh;
}

/** Stats about H3 cell compaction when compact view is enabled */
export type CompactionStats = {
  original: number;
  compacted: number;
  reduction: number;
};

type ForestLossMapProps = {
  opacity: number;
  useCompactView: boolean;
  onCompactionStatsChange?: (stats: CompactionStats | null) => void;
};

export function ForestLossMap({
  opacity,
  useCompactView,
  onCompactionStatsChange,
}: ForestLossMapProps) {
  const forestLossBloc = useForestLossBloc();
  const forestLossState = useForestLossBlocState();

  // Local view state - not shared with the SF map
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE);
  const [currentResolution, setCurrentResolution] = useState(
    getResolutionForZoom(INITIAL_VIEW_STATE.zoom)
  );

  // Track hovered cell for neighbor highlighting
  const [hoveredCellId, setHoveredCellId] = useState<string | null>(null);

  // Track selected cell for metadata display
  const [selectedCell, setSelectedCell] = useState<ForestLossCell | null>(null);

  // Track if we've done initial load
  const hasLoadedRef = useRef(false);
  // Debounce timer ref for resolution changes
  const resolutionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Load initial data on mount
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      const resolution = getResolutionForZoom(viewState.zoom);
      forestLossBloc.add({ type: "load", resolution });
    }
  }, [forestLossBloc, viewState.zoom]);

  // Handle zoom-based resolution changes with debouncing
  useEffect(() => {
    const newResolution = getResolutionForZoom(viewState.zoom);
    if (newResolution !== currentResolution && hasLoadedRef.current) {
      // Clear any pending resolution change
      if (resolutionDebounceRef.current) {
        clearTimeout(resolutionDebounceRef.current);
      }

      // Debounce the resolution change to avoid rapid switches during zoom
      resolutionDebounceRef.current = setTimeout(() => {
        setCurrentResolution(newResolution);
        forestLossBloc.add({ type: "load", resolution: newResolution });
      }, RESOLUTION_CHANGE_DEBOUNCE_MS);
    }

    return () => {
      if (resolutionDebounceRef.current) {
        clearTimeout(resolutionDebounceRef.current);
      }
    };
  }, [viewState.zoom, currentResolution, forestLossBloc]);

  const handleViewStateChange = useCallback(
    ({ viewState: newViewState }: { viewState: MapViewState }) => {
      setViewState(newViewState);
    },
    []
  );

  // Extract and optionally filter data, with optional compaction
  const { cells, maxLoss, compactionStats } = useMemo(() => {
    if (forestLossState.status !== "loaded") {
      return { cells: [], maxLoss: 1, compactionStats: null };
    }

    const { data, yearFilter } = forestLossState;

    // Apply year filter if set
    let filteredCells = data;
    if (yearFilter.minYear !== null || yearFilter.maxYear !== null) {
      filteredCells = data
        .map((cell) => {
          const filteredByYear: Record<number, number> = {};
          let filteredTotal = 0;

          for (const [yearStr, count] of Object.entries(cell.byYear)) {
            const year = parseInt(yearStr);
            const inRange =
              (yearFilter.minYear === null || year >= yearFilter.minYear) &&
              (yearFilter.maxYear === null || year <= yearFilter.maxYear);
            if (inRange) {
              filteredByYear[year] = count;
              filteredTotal += count;
            }
          }

          return { ...cell, byYear: filteredByYear, totalLoss: filteredTotal };
        })
        .filter((cell) => cell.totalLoss > 0);
    }

    // Apply H3 compaction if enabled
    if (useCompactView && filteredCells.length > 0) {
      const originalCount = filteredCells.length;

      // Create a map from H3 index to cell data for quick lookup
      const cellDataMap = new Map<string, ForestLossCell>();
      for (const cell of filteredCells) {
        cellDataMap.set(cell.h3, cell);
      }

      // Compact the H3 indexes - this replaces groups of 7 children with their parent
      const compactedIndexes = h3.compactCells(filteredCells.map((c) => c.h3));

      // Aggregate data for compacted cells
      const compactedCells: ForestLossCell[] = compactedIndexes.map(
        (h3Index) => {
          // Check if this is an original cell (not compacted)
          const existingCell = cellDataMap.get(h3Index);
          if (existingCell) {
            return existingCell;
          }

          // This is a parent cell - aggregate children's data
          // Use the first cell's resolution as the original data resolution
          const firstCell = filteredCells[0];
          if (!firstCell) {
            return { h3: h3Index, totalLoss: 0, byYear: {} };
          }
          const originalResolution = h3.getResolution(firstCell.h3);
          const childIndexes = h3.cellToChildren(h3Index, originalResolution);

          const aggregatedByYear: Record<number, number> = {};
          let aggregatedTotal = 0;

          for (const childIndex of childIndexes) {
            const childCell = cellDataMap.get(childIndex);
            if (childCell) {
              aggregatedTotal += childCell.totalLoss;
              for (const [yearStr, count] of Object.entries(childCell.byYear)) {
                const year = parseInt(yearStr);
                aggregatedByYear[year] = (aggregatedByYear[year] || 0) + count;
              }
            }
          }

          return {
            h3: h3Index,
            totalLoss: aggregatedTotal,
            byYear: aggregatedByYear,
          };
        }
      );

      const max = Math.max(...compactedCells.map((c) => c.totalLoss), 1);
      return {
        cells: compactedCells,
        maxLoss: max,
        compactionStats: {
          original: originalCount,
          compacted: compactedCells.length,
          reduction: Math.round(
            ((originalCount - compactedCells.length) / originalCount) * 100
          ),
        },
      };
    }

    const max = Math.max(...filteredCells.map((c) => c.totalLoss), 1);
    return { cells: filteredCells, maxLoss: max, compactionStats: null };
  }, [forestLossState, useCompactView]);

  // Notify parent of compaction stats changes
  useEffect(() => {
    onCompactionStatsChange?.(compactionStats);
  }, [compactionStats, onCompactionStatsChange]);

  // Compute neighbor cell polygons for highlighting
  const neighborPolygons = useMemo(() => {
    if (!hoveredCellId) return [];

    // Get the hovered cell plus all neighbors within 1 ring
    const neighborCells = h3.gridDisk(hoveredCellId, 1);

    return neighborCells.map((cellId) => {
      // cellToBoundary returns [lat, lng] pairs, we need [lng, lat] for deck.gl
      const boundary = h3.cellToBoundary(cellId);
      const polygon = boundary.map(([lat, lng]) => [lng, lat]);

      return {
        id: cellId,
        polygon,
        isCenter: cellId === hoveredCellId,
      };
    });
  }, [hoveredCellId]);

  const onHover = useCallback((info: PickingInfo) => {
    if (info.layer?.id === "forest-loss-h3" && info.object) {
      const cell = info.object as ForestLossCell;
      setHoveredCellId(cell.h3);
    } else {
      setHoveredCellId(null);
    }
  }, []);

  const onClick = useCallback((info: PickingInfo) => {
    if (!info.object || !info.layer) {
      // Clicking empty space clears the selection
      setSelectedCell(null);
      return;
    }

    if (info.layer.id === "forest-loss-h3") {
      const cell = info.object as ForestLossCell;
      setSelectedCell(cell);
    }
  }, []);

  const layers = [
    forestLossState.status === "loaded" &&
      new H3HexagonLayer<ForestLossCell>({
        id: "forest-loss-h3",
        data: cells,
        getHexagon: (d) => d.h3,
        getFillColor: (d) => getLossColor(d.totalLoss, maxLoss),
        // Normalize elevation to 0-1 range, then scale to reasonable height
        getElevation: (d) => (d.totalLoss / maxLoss) * 5000,
        elevationScale: 1,
        extruded: true,
        pickable: true,
        opacity,
        coverage: 0.9,
        material: {
          ambient: 0.64,
          diffuse: 0.6,
          shininess: 32,
        },
      }),
    // Neighbor highlight layer - renders on top of hexagons
    neighborPolygons.length > 0 &&
      new PolygonLayer({
        id: "neighbor-highlight",
        data: neighborPolygons,
        getPolygon: (d) => d.polygon,
        getFillColor: (d) =>
          d.isCenter
            ? [255, 255, 255, 60] // White highlight for center
            : [100, 200, 255, 40], // Light blue for neighbors
        getLineColor: (d) =>
          d.isCenter
            ? [255, 255, 255, 255] // White border for center
            : [100, 200, 255, 200], // Light blue border for neighbors
        getLineWidth: (d) => (d.isCenter ? 3 : 2),
        lineWidthUnits: "pixels",
        filled: true,
        stroked: true,
        pickable: false,
        // Render slightly above the hexagons to ensure visibility
        getElevation: 100,
        extruded: false,
      }),
  ].filter(Boolean);

  // Compute H3 metadata for selected cell
  const cellMetadata = useMemo(() => {
    if (!selectedCell) return null;

    const resolution = h3.getResolution(selectedCell.h3);
    const areaKm2 = h3.cellArea(selectedCell.h3, "km2");
    const parentCell =
      resolution > 0 ? h3.cellToParent(selectedCell.h3, resolution - 1) : null;
    const childCount =
      resolution < 15
        ? h3.cellToChildren(selectedCell.h3, resolution + 1).length
        : 0;

    // Get center coordinates
    const [lat, lng] = h3.cellToLatLng(selectedCell.h3);

    return {
      resolution,
      areaKm2,
      parentCell,
      childCount,
      lat,
      lng,
    };
  }, [selectedCell]);

  return (
    <>
      <DeckGL
        viewState={viewState}
        onViewStateChange={handleViewStateChange as (params: unknown) => void}
        controller={true}
        layers={layers}
        onClick={onClick}
        onHover={onHover}
        getTooltip={({ object, layer }) => {
          if (!object || !layer) return null;
          if (layer.id !== "forest-loss-h3") return null;

          const cell = object as ForestLossCell;

          // Find peak year
          let peakYear = 0;
          let peakCount = 0;
          for (const [yearStr, count] of Object.entries(cell.byYear)) {
            if (count > peakCount) {
              peakCount = count;
              peakYear = parseInt(yearStr);
            }
          }

          return {
            html: `<div class="p-2">
            <strong>Forest Loss</strong><br/>
            Total: ${cell.totalLoss.toLocaleString()} pixels<br/>
            ${
              peakYear > 0
                ? `Peak: ${2000 + peakYear} (${peakCount.toLocaleString()})`
                : ""
            }
          </div>`,
            style: {
              backgroundColor: "#1f2937",
              color: "white",
              fontSize: "12px",
              borderRadius: "4px",
            },
          };
        }}
      >
        <MapLibreMap
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
          attributionControl={false}
        />
      </DeckGL>

      {/* Cell Metadata Panel */}
      {selectedCell && cellMetadata && (
        <div className="absolute right-4 bottom-4 bg-gray-800/95 text-white text-sm rounded-lg shadow-xl p-4 max-w-xs backdrop-blur-sm">
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-semibold text-base">H3 Cell Details</h3>
            <button
              onClick={() => setSelectedCell(null)}
              className="text-gray-400 hover:text-white -mt-1"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2 text-gray-300">
            <div>
              <span className="text-gray-500 text-xs">Cell Index</span>
              <p className="font-mono text-xs break-all">{selectedCell.h3}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-gray-500 text-xs">Resolution</span>
                <p className="font-medium">{cellMetadata.resolution}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Area</span>
                <p className="font-medium">
                  {cellMetadata.areaKm2.toFixed(1)} km²
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Children (res+1)</span>
                <p className="font-medium">{cellMetadata.childCount} cells</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Total Loss</span>
                <p className="font-medium">
                  {selectedCell.totalLoss.toLocaleString()}
                </p>
              </div>
            </div>

            <div>
              <span className="text-gray-500 text-xs">Center</span>
              <p className="font-mono text-xs">
                {cellMetadata.lat.toFixed(4)}°, {cellMetadata.lng.toFixed(4)}°
              </p>
            </div>

            {cellMetadata.parentCell && (
              <div>
                <span className="text-gray-500 text-xs">
                  Parent Cell (res-1)
                </span>
                <p className="font-mono text-xs break-all">
                  {cellMetadata.parentCell}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
