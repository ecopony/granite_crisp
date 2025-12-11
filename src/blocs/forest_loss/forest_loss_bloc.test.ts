import { describe, it, expect, beforeEach, vi } from "vitest";
import { ForestLossBloc } from "./forest_loss_bloc";
import type { ForestLossResponse } from "./forest_loss_state";
import {
  MockForestLossService,
  type ForestLossService,
} from "../../services/forest_loss_service";

/**
 * ForestLossBloc Tests
 *
 * Tests for the H3 forest loss visualization bloc.
 * Key features to test:
 * 1. Resolution-based data loading
 * 2. Resolution caching (avoid re-fetching)
 * 3. Year filtering
 * 4. State transitions
 */

const createMockResponse = (resolution: number): ForestLossResponse => ({
  generated: "2024-01-15T10:30:00Z",
  source: "Hansen GFC 2023 (Mock)",
  resolution,
  bounds: { north: 49, south: 42, east: -117, west: -125 },
  sampleRate: 10,
  totalCells: 3,
  cells: [
    {
      h3: `84${resolution}a100ffffffff`,
      totalLoss: 1000,
      byYear: { 15: 300, 16: 400, 17: 300 },
    },
    {
      h3: `84${resolution}a101ffffffff`,
      totalLoss: 500,
      byYear: { 18: 200, 19: 300 },
    },
    {
      h3: `84${resolution}a102ffffffff`,
      totalLoss: 750,
      byYear: { 15: 250, 20: 500 },
    },
  ],
});

describe("ForestLossBloc", () => {
  describe("with successful service", () => {
    let bloc: ForestLossBloc;
    let mockService: MockForestLossService;

    beforeEach(() => {
      const mockData = new Map([
        [4, createMockResponse(4)],
        [5, createMockResponse(5)],
        [6, createMockResponse(6)],
        [7, createMockResponse(7)],
      ]);
      mockService = new MockForestLossService(mockData);
      bloc = new ForestLossBloc(mockService);
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

        bloc.add({ type: "load", resolution: 5 });

        await vi.waitFor(() => {
          expect(bloc.state.status).toBe("loaded");
        });

        expect(states).toContain("loading");
        expect(states).toContain("loaded");
      });

      it("should populate data with correct resolution", async () => {
        bloc.add({ type: "load", resolution: 5 });

        await vi.waitFor(() => {
          expect(bloc.state.status).toBe("loaded");
        });

        if (bloc.state.status === "loaded") {
          expect(bloc.state.resolution).toBe(5);
          expect(bloc.state.data).toHaveLength(3);
          expect(bloc.state.source).toBe("Hansen GFC 2023 (Mock)");
          expect(bloc.state.bounds.north).toBe(49);
        }
      });

      it("should initialize year filter to null values", async () => {
        bloc.add({ type: "load", resolution: 5 });

        await vi.waitFor(() => {
          expect(bloc.state.status).toBe("loaded");
        });

        if (bloc.state.status === "loaded") {
          expect(bloc.state.yearFilter.minYear).toBeNull();
          expect(bloc.state.yearFilter.maxYear).toBeNull();
        }
      });
    });

    describe("resolution caching", () => {
      it("should cache loaded resolutions", async () => {
        bloc.add({ type: "load", resolution: 5 });
        await vi.waitFor(() => expect(bloc.state.status).toBe("loaded"));

        if (bloc.state.status === "loaded") {
          expect(bloc.state.cache.has(5)).toBe(true);
          expect(bloc.state.cache.get(5)).toHaveLength(3);
        }
      });

      it("should use cache when switching back to loaded resolution", async () => {
        // Load resolution 5
        bloc.add({ type: "load", resolution: 5 });
        await vi.waitFor(() => expect(bloc.state.status).toBe("loaded"));

        // Load resolution 6
        bloc.add({ type: "load", resolution: 6 });
        await vi.waitFor(() => {
          if (bloc.state.status === "loaded") {
            return bloc.state.resolution === 6;
          }
          return false;
        });

        // Spy on service
        const fetchSpy = vi.spyOn(mockService, "fetchForestLoss");

        // Switch back to resolution 5 - should use cache
        bloc.add({ type: "load", resolution: 5 });

        // Cache hit should be synchronous, so state should already be resolution 5
        expect(bloc.state.status).toBe("loaded");
        if (bloc.state.status === "loaded") {
          expect(bloc.state.resolution).toBe(5);
        }

        // Service should NOT have been called
        expect(fetchSpy).not.toHaveBeenCalled();
      });

      it("should preserve cache across resolution changes", async () => {
        bloc.add({ type: "load", resolution: 5 });
        await vi.waitFor(() => expect(bloc.state.status).toBe("loaded"));

        bloc.add({ type: "load", resolution: 6 });
        await vi.waitFor(() => {
          if (bloc.state.status === "loaded") {
            return bloc.state.resolution === 6;
          }
          return false;
        });

        if (bloc.state.status === "loaded") {
          // Both resolutions should be in cache
          expect(bloc.state.cache.has(5)).toBe(true);
          expect(bloc.state.cache.has(6)).toBe(true);
        }
      });
    });

    describe("load event with resolution change", () => {
      it("should fetch new resolution if not cached", async () => {
        bloc.add({ type: "load", resolution: 5 });
        await vi.waitFor(() => expect(bloc.state.status).toBe("loaded"));

        const fetchSpy = vi.spyOn(mockService, "fetchForestLoss");

        bloc.add({ type: "load", resolution: 7 });

        await vi.waitFor(() => {
          if (bloc.state.status === "loaded") {
            return bloc.state.resolution === 7;
          }
          return false;
        });

        expect(fetchSpy).toHaveBeenCalledWith(7);
      });
    });

    describe("year filter events", () => {
      beforeEach(async () => {
        bloc.add({ type: "load", resolution: 5 });
        await vi.waitFor(() => expect(bloc.state.status).toBe("loaded"));
      });

      it("should set year filter", () => {
        bloc.add({ type: "setYearFilter", minYear: 15, maxYear: 17 });

        if (bloc.state.status === "loaded") {
          expect(bloc.state.yearFilter.minYear).toBe(15);
          expect(bloc.state.yearFilter.maxYear).toBe(17);
        }
      });

      it("should allow partial year filter (min only)", () => {
        bloc.add({ type: "setYearFilter", minYear: 18, maxYear: null });

        if (bloc.state.status === "loaded") {
          expect(bloc.state.yearFilter.minYear).toBe(18);
          expect(bloc.state.yearFilter.maxYear).toBeNull();
        }
      });

      it("should allow partial year filter (max only)", () => {
        bloc.add({ type: "setYearFilter", minYear: null, maxYear: 16 });

        if (bloc.state.status === "loaded") {
          expect(bloc.state.yearFilter.minYear).toBeNull();
          expect(bloc.state.yearFilter.maxYear).toBe(16);
        }
      });

      it("should clear year filter", () => {
        bloc.add({ type: "setYearFilter", minYear: 15, maxYear: 17 });
        bloc.add({ type: "clearYearFilter" });

        if (bloc.state.status === "loaded") {
          expect(bloc.state.yearFilter.minYear).toBeNull();
          expect(bloc.state.yearFilter.maxYear).toBeNull();
        }
      });

      it("should not modify data when setting filter (filtering is done in component)", () => {
        const dataBefore =
          bloc.state.status === "loaded" ? bloc.state.data : [];

        bloc.add({ type: "setYearFilter", minYear: 15, maxYear: 15 });

        if (bloc.state.status === "loaded") {
          // Data should still have all cells - filtering is done in ForestLossMap
          expect(bloc.state.data).toBe(dataBefore);
        }
      });
    });

    describe("clearError event", () => {
      it("should do nothing if not in error state", async () => {
        bloc.add({ type: "load", resolution: 5 });
        await vi.waitFor(() => expect(bloc.state.status).toBe("loaded"));

        const stateBefore = bloc.state;
        bloc.add({ type: "clearError" });

        expect(bloc.state).toBe(stateBefore);
      });
    });
  });

  describe("with failing service", () => {
    let bloc: ForestLossBloc;

    beforeEach(() => {
      const failingService = new MockForestLossService(new Map(), true);
      bloc = new ForestLossBloc(failingService);
    });

    it("should transition to error state on failure", async () => {
      bloc.add({ type: "load", resolution: 5 });

      await vi.waitFor(() => {
        expect(bloc.state.status).toBe("error");
      });

      if (bloc.state.status === "error") {
        expect(bloc.state.message).toBe("Mock error for testing");
        expect(bloc.state.resolution).toBe(5);
      }
    });

    it("should go through loading before error", async () => {
      const states: string[] = [];
      bloc.subscribe((state) => states.push(state.status));

      bloc.add({ type: "load", resolution: 5 });

      await vi.waitFor(() => expect(bloc.state.status).toBe("error"));

      expect(states[0]).toBe("loading");
      expect(states[1]).toBe("error");
    });

    it("should reset to initial on clearError", async () => {
      bloc.add({ type: "load", resolution: 5 });
      await vi.waitFor(() => expect(bloc.state.status).toBe("error"));

      bloc.add({ type: "clearError" });

      expect(bloc.state.status).toBe("initial");
    });
  });

  describe("custom service injection", () => {
    it("should accept any implementation of ForestLossService", async () => {
      const customService: ForestLossService = {
        fetchForestLoss: async (resolution: number) => ({
          generated: new Date().toISOString(),
          source: "Custom H3 Service",
          resolution,
          bounds: { north: 50, south: 40, east: -110, west: -130 },
          sampleRate: 1,
          totalCells: 1,
          cells: [
            {
              h3: "custom_h3_index",
              totalLoss: 9999,
              byYear: { 21: 9999 },
            },
          ],
        }),
      };

      const bloc = new ForestLossBloc(customService);
      bloc.add({ type: "load", resolution: 6 });

      await vi.waitFor(() => expect(bloc.state.status).toBe("loaded"));

      if (bloc.state.status === "loaded") {
        expect(bloc.state.source).toBe("Custom H3 Service");
        expect(bloc.state.data[0]?.totalLoss).toBe(9999);
      }
    });
  });

  describe("resolution validation", () => {
    let bloc: ForestLossBloc;

    beforeEach(() => {
      const mockData = new Map([
        [4, createMockResponse(4)],
        [5, createMockResponse(5)],
      ]);
      const mockService = new MockForestLossService(mockData);
      bloc = new ForestLossBloc(mockService);
    });

    it("should reject invalid resolution with error state", () => {
      bloc.add({ type: "load", resolution: 3 });

      expect(bloc.state.status).toBe("error");
      if (bloc.state.status === "error") {
        expect(bloc.state.message).toContain("Invalid resolution: 3");
        expect(bloc.state.message).toContain("4, 5, 6, 7");
      }
    });

    it("should reject resolution 8 as invalid", () => {
      bloc.add({ type: "load", resolution: 8 });

      expect(bloc.state.status).toBe("error");
      if (bloc.state.status === "error") {
        expect(bloc.state.message).toContain("Invalid resolution: 8");
      }
    });
  });

  describe("duplicate load prevention", () => {
    it("should ignore duplicate load while already loading", async () => {
      const mockData = new Map([[5, createMockResponse(5)]]);
      const mockService = new MockForestLossService(mockData);
      const fetchSpy = vi.spyOn(mockService, "fetchForestLoss");

      const bloc = new ForestLossBloc(mockService);

      // Trigger multiple loads for the same resolution
      bloc.add({ type: "load", resolution: 5 });
      bloc.add({ type: "load", resolution: 5 });
      bloc.add({ type: "load", resolution: 5 });

      await vi.waitFor(() => expect(bloc.state.status).toBe("loaded"));

      // Should only have been called once
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("cache persistence across errors", () => {
    it("should preserve cache when error occurs and use it on retry", async () => {
      // Start with a working service
      const mockData = new Map([
        [5, createMockResponse(5)],
        [6, createMockResponse(6)],
      ]);
      let shouldFail = false;

      const dynamicService: ForestLossService = {
        fetchForestLoss: async (resolution: number) => {
          if (shouldFail) {
            throw new Error("Simulated failure");
          }
          const data = mockData.get(resolution);
          if (!data) throw new Error(`No data for res ${resolution}`);
          return data;
        },
      };

      const bloc = new ForestLossBloc(dynamicService);

      // Load resolution 5 successfully
      bloc.add({ type: "load", resolution: 5 });
      await vi.waitFor(() => expect(bloc.state.status).toBe("loaded"));

      // Make service fail and try to load resolution 6
      shouldFail = true;
      bloc.add({ type: "load", resolution: 6 });
      await vi.waitFor(() => expect(bloc.state.status).toBe("error"));

      // Now switch back to resolution 5 - should use cached data
      shouldFail = false; // Even though we're not failing, the cache should be used
      bloc.add({ type: "load", resolution: 5 });

      // Cache hit should be synchronous
      expect(bloc.state.status).toBe("loaded");
      if (bloc.state.status === "loaded") {
        expect(bloc.state.resolution).toBe(5);
      }
    });
  });
});
