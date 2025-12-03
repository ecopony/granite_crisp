import type { Sf311Response } from "../blocs/sf311/sf311_state";

/**
 * SF 311 Service Interface
 *
 * Abstracts data fetching for testability and flexibility.
 */
export interface Sf311Service {
  fetchRequests(): Promise<Sf311Response>;
}

/**
 * HTTP implementation - fetches from local JSON file.
 */
export class HttpSf311Service implements Sf311Service {
  constructor(private baseUrl: string = "") {}

  async fetchRequests(): Promise<Sf311Response> {
    const response = await fetch(`${this.baseUrl}/data/sf-311.json`);

    if (!response.ok) {
      throw new Error(`Failed to fetch 311 data: ${response.status}`);
    }

    return response.json();
  }
}

/**
 * Mock service for testing.
 */
export class MockSf311Service implements Sf311Service {
  constructor(
    private mockData: Sf311Response,
    private shouldFail = false
  ) {}

  async fetchRequests(): Promise<Sf311Response> {
    if (this.shouldFail) {
      throw new Error("Mock error for testing");
    }
    return this.mockData;
  }
}
