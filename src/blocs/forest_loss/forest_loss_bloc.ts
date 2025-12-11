import { Bloc } from "@granite-crisp/react-bloc";
import type { ForestLossService } from "../../services/forest_loss_service";
import { HttpForestLossService } from "../../services/forest_loss_service";
import type { ForestLossEvent } from "./forest_loss_event";
import type { ForestLossState, ForestLossCell } from "./forest_loss_state";
import { initialForestLossState } from "./forest_loss_state";

/** Valid H3 resolutions for forest loss data */
const VALID_RESOLUTIONS = [4, 5, 6, 7] as const;

/**
 * ForestLossBloc - Manages H3 forest loss data with resolution switching
 *
 * Key features:
 * 1. Resolution-based data loading (res 4-7)
 * 2. Caches loaded resolutions to avoid re-fetching
 * 3. Year filtering for temporal analysis
 * 4. Follows existing async BLoC patterns
 */
export class ForestLossBloc extends Bloc<ForestLossEvent, ForestLossState> {
  /** Preserved cache for recovery after errors */
  private persistentCache = new Map<number, ForestLossCell[]>();

  constructor(
    private service: ForestLossService = new HttpForestLossService()
  ) {
    super(initialForestLossState);
  }

  add(event: ForestLossEvent): void {
    switch (event.type) {
      case "load":
        this.handleLoad(event.resolution);
        break;

      case "setYearFilter":
        this.handleSetYearFilter(event.minYear, event.maxYear);
        break;

      case "clearYearFilter":
        this.handleClearYearFilter();
        break;

      case "clearError":
        if (this.state.status === "error") {
          this.emitState(initialForestLossState);
        }
        break;
    }
  }

  private async handleLoad(resolution: number): Promise<void> {
    // Validate resolution
    if (!VALID_RESOLUTIONS.includes(resolution as typeof VALID_RESOLUTIONS[number])) {
      this.emitState({
        status: "error",
        message: `Invalid resolution: ${resolution}. Must be one of ${VALID_RESOLUTIONS.join(", ")}`,
        resolution,
      });
      return;
    }

    // Prevent duplicate loads - if already loading this resolution, ignore
    if (this.state.status === "loading" && this.state.resolution === resolution) {
      return;
    }

    // Check cache first (works from any state due to persistent cache)
    const cached = this.persistentCache.get(resolution);
    if (cached) {
      this.emitState({
        status: "loaded",
        resolution,
        data: cached,
        bounds: this.state.status === "loaded" ? this.state.bounds : { north: 49, south: 42, east: -117, west: -125 },
        source: this.state.status === "loaded" ? this.state.source : "Hansen GFC 2023 v1.11",
        yearFilter: this.state.status === "loaded" ? this.state.yearFilter : { minYear: null, maxYear: null },
        cache: this.persistentCache,
      });
      return;
    }

    this.emitState({ status: "loading", resolution });

    try {
      const response = await this.service.fetchForestLoss(resolution);

      // Update persistent cache
      this.persistentCache.set(resolution, response.cells);

      this.emitState({
        status: "loaded",
        resolution,
        data: response.cells,
        bounds: response.bounds,
        source: response.source,
        yearFilter: { minYear: null, maxYear: null },
        cache: this.persistentCache,
      });
    } catch (e) {
      this.emitState({
        status: "error",
        message:
          e instanceof Error ? e.message : "Failed to load forest loss data",
        resolution,
      });
    }
  }

  private handleSetYearFilter(
    minYear: number | null,
    maxYear: number | null
  ): void {
    if (this.state.status === "loaded") {
      this.emitState({
        ...this.state,
        yearFilter: { minYear, maxYear },
      });
    }
  }

  private handleClearYearFilter(): void {
    if (this.state.status === "loaded") {
      this.emitState({
        ...this.state,
        yearFilter: { minYear: null, maxYear: null },
      });
    }
  }
}
