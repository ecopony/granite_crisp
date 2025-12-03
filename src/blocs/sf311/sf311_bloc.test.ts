import { describe, it, expect, beforeEach, vi } from "vitest";
import { Sf311Bloc } from "./sf311_bloc";
import type { Sf311Response } from "./sf311_state";
import { MockSf311Service, type Sf311Service } from "../../services/sf311_service";

/**
 * Sf311Bloc Tests
 *
 * Simpler than AirQualityBloc tests since Sf311Bloc doesn't have:
 * - Viewport-based reloading
 * - Debouncing
 * - Bloc-to-bloc communication
 *
 * We still test:
 * 1. State transitions (initial -> loading -> loaded/error)
 * 2. Service injection
 * 3. Event handling (load, refresh, clearError)
 */

const mockResponse: Sf311Response = {
  generated: "2024-01-15T10:30:00Z",
  source: "Test SF 311 Data",
  description: "Mock data for testing",
  count: 3,
  requests: [
    {
      id: 1,
      position: [-122.41, 37.78],
      category: "Graffiti",
      neighborhood: "Mission",
      created: "2024-01-14T08:00:00Z",
    },
    {
      id: 2,
      position: [-122.4, 37.79],
      category: "Pothole",
      neighborhood: "Downtown",
      created: "2024-01-14T09:00:00Z",
    },
    {
      id: 3,
      position: [-122.42, 37.77],
      category: "Streetlight",
      neighborhood: "Castro",
      created: "2024-01-14T10:00:00Z",
    },
  ],
};

describe("Sf311Bloc", () => {
  describe("with successful service", () => {
    let bloc: Sf311Bloc;
    let mockService: MockSf311Service;

    beforeEach(() => {
      mockService = new MockSf311Service(mockResponse);
      bloc = new Sf311Bloc(mockService);
    });

    describe("initial state", () => {
      it("should start in initial status", () => {
        expect(bloc.state.status).toBe("initial");
      });
    });

    describe("load event", () => {
      it("should transition to loading then loaded", async () => {
        const states: string[] = [];
        bloc.subscribe((state) => states.push(state.status));

        bloc.add({ type: "load" });

        await vi.waitFor(() => {
          expect(bloc.state.status).toBe("loaded");
        });

        expect(states).toContain("loading");
        expect(states).toContain("loaded");
      });

      it("should populate data on success", async () => {
        bloc.add({ type: "load" });

        await vi.waitFor(() => {
          expect(bloc.state.status).toBe("loaded");
        });

        if (bloc.state.status === "loaded") {
          expect(bloc.state.data).toHaveLength(3);
          expect(bloc.state.count).toBe(3);
          expect(bloc.state.source).toBe("Test SF 311 Data");
          expect(bloc.state.data[0]!.category).toBe("Graffiti");
        }
      });

      it("should not reload if already loaded (use refresh instead)", async () => {
        bloc.add({ type: "load" });
        await vi.waitFor(() => expect(bloc.state.status).toBe("loaded"));

        const fetchSpy = vi.spyOn(mockService, "fetchRequests");

        bloc.add({ type: "load" });

        expect(fetchSpy).not.toHaveBeenCalled();
      });
    });

    describe("refresh event", () => {
      it("should reload data even if already loaded", async () => {
        bloc.add({ type: "load" });
        await vi.waitFor(() => expect(bloc.state.status).toBe("loaded"));

        const fetchSpy = vi.spyOn(mockService, "fetchRequests");

        bloc.add({ type: "refresh" });

        await vi.waitFor(() => {
          expect(fetchSpy).toHaveBeenCalled();
        });
      });

      it("should work from initial state", async () => {
        const fetchSpy = vi.spyOn(mockService, "fetchRequests");

        bloc.add({ type: "refresh" });

        await vi.waitFor(() => {
          expect(bloc.state.status).toBe("loaded");
        });

        expect(fetchSpy).toHaveBeenCalled();
      });

      it("should work from error state", async () => {
        const failingService = new MockSf311Service(mockResponse, true);
        const errorBloc = new Sf311Bloc(failingService);

        errorBloc.add({ type: "load" });
        await vi.waitFor(() => expect(errorBloc.state.status).toBe("error"));

        vi.spyOn(failingService, "fetchRequests").mockResolvedValue(mockResponse);
        errorBloc.add({ type: "refresh" });

        await vi.waitFor(() => expect(errorBloc.state.status).toBe("loaded"));
      });
    });
  });

  describe("with failing service", () => {
    let bloc: Sf311Bloc;

    beforeEach(() => {
      const failingService = new MockSf311Service(mockResponse, true);
      bloc = new Sf311Bloc(failingService);
    });

    it("should transition to error state on failure", async () => {
      bloc.add({ type: "load" });

      await vi.waitFor(() => {
        expect(bloc.state.status).toBe("error");
      });

      if (bloc.state.status === "error") {
        expect(bloc.state.message).toBe("Mock error for testing");
      }
    });

    it("should go through loading before error", async () => {
      const states: string[] = [];
      bloc.subscribe((state) => states.push(state.status));

      bloc.add({ type: "load" });

      await vi.waitFor(() => expect(bloc.state.status).toBe("error"));

      expect(states[0]).toBe("loading");
      expect(states[1]).toBe("error");
    });
  });

  describe("clearError event", () => {
    it("should reset to initial state from error", async () => {
      const failingService = new MockSf311Service(mockResponse, true);
      const bloc = new Sf311Bloc(failingService);

      bloc.add({ type: "load" });
      await vi.waitFor(() => expect(bloc.state.status).toBe("error"));

      bloc.add({ type: "clearError" });

      expect(bloc.state.status).toBe("initial");
    });

    it("should do nothing if not in error state", async () => {
      const bloc = new Sf311Bloc(new MockSf311Service(mockResponse));

      bloc.add({ type: "load" });
      await vi.waitFor(() => expect(bloc.state.status).toBe("loaded"));

      const stateBefore = bloc.state;
      bloc.add({ type: "clearError" });

      expect(bloc.state).toBe(stateBefore);
    });
  });

  describe("custom service injection", () => {
    it("should accept any implementation of Sf311Service", async () => {
      const customService: Sf311Service = {
        fetchRequests: async () => ({
          generated: new Date().toISOString(),
          source: "Custom Service",
          description: "Custom test",
          count: 1,
          requests: [
            {
              id: 99,
              position: [0, 0],
              category: "Custom",
              neighborhood: "Test",
              created: new Date().toISOString(),
            },
          ],
        }),
      };

      const bloc = new Sf311Bloc(customService);
      bloc.add({ type: "load" });

      await vi.waitFor(() => expect(bloc.state.status).toBe("loaded"));

      if (bloc.state.status === "loaded") {
        expect(bloc.state.source).toBe("Custom Service");
        expect(bloc.state.data[0]!.id).toBe(99);
      }
    });
  });
});
