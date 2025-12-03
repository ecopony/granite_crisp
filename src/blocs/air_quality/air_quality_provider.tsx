import { createBlocProvider } from "../bloc_provider";
import type { AirQualityBloc } from "./air_quality_bloc";

/**
 * AirQualityBloc Provider and hooks.
 *
 * The AirQualityBloc accepts a service in its constructor, making it
 * ideal for the provider pattern — you can inject different services
 * for testing vs production:
 *
 * @example
 * // Production: real HTTP service (default)
 * <AirQualityBlocProvider bloc={new AirQualityBloc()}>
 *
 * // Testing: mock service
 * <AirQualityBlocProvider bloc={new AirQualityBloc(mockService)}>
 *
 * // In child components
 * const bloc = useAirQualityBloc();
 * const state = useAirQualityBlocState();
 *
 * // Union state pattern — exhaustive switch
 * switch (state.status) {
 *   case "initial": return <LoadButton />;
 *   case "loading": return <Spinner />;
 *   case "loaded": return <DataView data={state.data} />;
 *   case "error": return <ErrorView message={state.message} />;
 * }
 */
export const {
  Provider: AirQualityBlocProvider,
  useBloc: useAirQualityBloc,
  useBlocState: useAirQualityBlocState,
  useBlocSelector: useAirQualityBlocSelector,
  Context: AirQualityBlocContext,
} = createBlocProvider<AirQualityBloc>("AirQualityBloc");
