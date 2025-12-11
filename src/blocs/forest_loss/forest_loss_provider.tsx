import { createBlocProvider } from "@granite-crisp/react-bloc";
import type { ForestLossBloc } from "./forest_loss_bloc";

/**
 * Forest Loss Bloc Provider and hooks.
 *
 * Generated using createBlocProvider factory:
 * - Provider: Wraps children with ForestLossBloc context
 * - useBloc: Get bloc instance for dispatching events
 * - useBlocState: Subscribe to full state
 * - useBlocSelector: Subscribe to derived state slice
 */
export const {
  Provider: ForestLossBlocProvider,
  useBloc: useForestLossBloc,
  useBlocState: useForestLossBlocState,
  useBlocSelector: useForestLossBlocSelector,
  Context: ForestLossBlocContext,
} = createBlocProvider<ForestLossBloc>("ForestLossBloc");
