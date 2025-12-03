import { createBlocProvider } from "../bloc_provider";
import type { Sf311Bloc } from "./sf311_bloc";

/**
 * SF 311 Bloc Provider and hooks.
 *
 * Provides the same pattern as AirQualityBloc - context-based access
 * with useBloc() for the bloc instance and useBlocState() for reactive state.
 */
export const {
  Provider: Sf311BlocProvider,
  useBloc: useSf311Bloc,
  useBlocState: useSf311BlocState,
  useBlocSelector: useSf311BlocSelector,
  Context: Sf311BlocContext,
} = createBlocProvider<Sf311Bloc>("Sf311Bloc");
