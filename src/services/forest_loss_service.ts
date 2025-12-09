import type { ForestLossResponse } from "../blocs/forest_loss/forest_loss_state";

/**
 * Forest Loss Service Interface
 *
 * Abstracts data fetching for testability and flexibility.
 * Resolution parameter determines which pre-computed H3 file to fetch.
 */
export interface ForestLossService {
  fetchForestLoss(resolution: number): Promise<ForestLossResponse>;
}

/**
 * HTTP implementation - fetches from local JSON files.
 */
export class HttpForestLossService implements ForestLossService {
  constructor(private baseUrl: string = "") {}

  async fetchForestLoss(resolution: number): Promise<ForestLossResponse> {
    const validResolutions = [4, 5, 6, 7];
    if (!validResolutions.includes(resolution)) {
      throw new Error(
        `Invalid resolution: ${resolution}. Must be one of ${validResolutions.join(", ")}`
      );
    }

    const response = await fetch(
      `${this.baseUrl}/data/forest-loss-res${resolution}.json`
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch forest loss data (res ${resolution}): ${response.status}`
      );
    }

    return response.json();
  }
}

/**
 * Mock service for testing.
 */
export class MockForestLossService implements ForestLossService {
  constructor(
    private mockData: Map<number, ForestLossResponse>,
    private shouldFail = false
  ) {}

  async fetchForestLoss(resolution: number): Promise<ForestLossResponse> {
    if (this.shouldFail) {
      throw new Error("Mock error for testing");
    }
    const data = this.mockData.get(resolution);
    if (!data) {
      throw new Error(`No mock data for resolution ${resolution}`);
    }
    return data;
  }
}
