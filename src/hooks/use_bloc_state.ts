import { useSyncExternalStore } from 'react'
import type { Bloc } from '@granite-crisp/react-bloc'

/**
 * Hook to subscribe a React component to a Bloc's state.
 *
 * Uses React 18's useSyncExternalStore for tear-resistant subscriptions,
 * ensuring the component always sees a consistent state snapshot.
 *
 * @example
 * const state = useBlocState(mapBloc)
 * // Component re-renders when mapBloc.state changes
 */
export function useBlocState<E, S>(bloc: Bloc<E, S>): S {
  return useSyncExternalStore(
    (callback) => bloc.subscribe(callback),
    () => bloc.state
  )
}

/**
 * Hook to subscribe to a selected slice of a Bloc's state.
 *
 * Use this when you only need part of the state to avoid unnecessary re-renders.
 * Note: The selector should return a stable reference for objects/arrays,
 * or the component will re-render on every state change.
 *
 * @example
 * const zoom = useBlocSelector(mapBloc, (s) => s.viewState.zoom)
 * // Only re-renders when zoom changes
 */
export function useBlocSelector<E, S, T>(
  bloc: Bloc<E, S>,
  selector: (state: S) => T
): T {
  return useSyncExternalStore(
    (callback) => bloc.subscribe(callback),
    () => selector(bloc.state)
  )
}
