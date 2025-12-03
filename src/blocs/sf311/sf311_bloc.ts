import type { Sf311Service } from "../../services/sf311_service";
import { HttpSf311Service } from "../../services/sf311_service";
import { Bloc } from "../base_bloc";
import type { Sf311Event } from "./sf311_event";
import type { Sf311State } from "./sf311_state";
import { initialSf311State } from "./sf311_state";

/**
 * Sf311Bloc - Manages SF 311 service request data for aggregation layers
 *
 * This bloc is simpler than AirQualityBloc:
 * - No viewport-based reloading (dataset is complete and local)
 * - Same union state pattern for type-safe status handling
 * - Service injection for testability
 */
export class Sf311Bloc extends Bloc<Sf311Event, Sf311State> {
  constructor(private service: Sf311Service = new HttpSf311Service()) {
    super(initialSf311State);
  }

  add(event: Sf311Event): void {
    switch (event.type) {
      case "load":
        if (this.state.status === "initial") {
          this.handleLoad();
        }
        break;

      case "refresh":
        this.handleLoad();
        break;

      case "clearError":
        if (this.state.status === "error") {
          this.emitState(initialSf311State);
        }
        break;
    }
  }

  private async handleLoad(): Promise<void> {
    this.emitState({ status: "loading" });

    try {
      const response = await this.service.fetchRequests();

      this.emitState({
        status: "loaded",
        data: response.requests,
        count: response.count,
        source: response.source,
      });
    } catch (e) {
      this.emitState({
        status: "error",
        message: e instanceof Error ? e.message : "Failed to load 311 data",
      });
    }
  }
}
