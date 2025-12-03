import type { AirQualityResponse } from '../blocs/air_quality/air_quality_state'

/**
 * Air Quality Service
 *
 * Handles all API communication for air quality data.
 * This layer is injected into the bloc, making the bloc testable
 * (you can inject a mock service in tests).
 */
export interface AirQualityService {
  fetchMeasurements(): Promise<AirQualityResponse>
}

/**
 * Real implementation that fetches from the JSON endpoint.
 * Includes artificial delay to demonstrate loading states.
 */
export class HttpAirQualityService implements AirQualityService {
  constructor(private baseUrl: string = '') {}

  async fetchMeasurements(): Promise<AirQualityResponse> {
    // Add artificial delay to show loading state (remove in production)
    await new Promise((resolve) => setTimeout(resolve, 800))

    const response = await fetch(`${this.baseUrl}/data/air-quality.json`)

    if (!response.ok) {
      throw new Error(`Failed to fetch air quality data: ${response.status}`)
    }

    return response.json()
  }
}

/**
 * Mock service for testing - returns data immediately
 */
export class MockAirQualityService implements AirQualityService {
  constructor(
    private mockData: AirQualityResponse,
    private shouldFail = false
  ) {}

  async fetchMeasurements(): Promise<AirQualityResponse> {
    if (this.shouldFail) {
      throw new Error('Mock error for testing')
    }
    return this.mockData
  }
}
