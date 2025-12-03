import { createContext, useContext, type ReactNode } from "react";
import { useSyncExternalStore } from "react";
import type { Bloc } from "./base_bloc";

/**
 * Factory function to create a typed Bloc Provider system.
 *
 * This follows Flutter's BlocProvider pattern, adapted for React:
 * - Provider component injects a bloc instance into the React tree
 * - useBloc() retrieves the bloc for dispatching events
 * - useBlocState() subscribes to state changes
 *
 * The factory approach eliminates boilerplate — one call creates all three.
 *
 * @example
 * // Create provider for MapBloc
 * const { Provider: MapBlocProvider, useBloc: useMapBloc, useBlocState: useMapBlocState } =
 *   createBlocProvider<MapBloc>("MapBloc");
 *
 * // In app root
 * <MapBlocProvider bloc={new MapBloc()}>
 *   <App />
 * </MapBlocProvider>
 *
 * // In any child component
 * const mapBloc = useMapBloc();           // Get bloc to dispatch events
 * const state = useMapBlocState();        // Subscribe to state
 * mapBloc.add({ type: "setZoom", zoom: 10 });
 */
export function createBlocProvider<B extends Bloc<unknown, unknown>>(
  displayName: string
) {
  // Create context with undefined default - we'll throw if used outside provider
  const BlocContext = createContext<B | undefined>(undefined);
  BlocContext.displayName = `${displayName}Context`;

  /**
   * Provider component that injects a bloc into the React tree.
   *
   * Key design choice: The bloc is passed as a prop, not created inside.
   * This allows:
   * - Different instances per subtree
   * - Pre-configured blocs (e.g., with injected services)
   * - Testing with mock blocs
   */
  function Provider({ bloc, children }: { bloc: B; children: ReactNode }) {
    return <BlocContext.Provider value={bloc}>{children}</BlocContext.Provider>;
  }
  Provider.displayName = `${displayName}Provider`;

  /**
   * Hook to retrieve the bloc instance for dispatching events.
   *
   * Use this when you need to call bloc.add() but don't need to subscribe
   * to state changes (e.g., event handlers, callbacks).
   *
   * @throws Error if used outside of Provider
   */
  function useBloc(): B {
    const bloc = useContext(BlocContext);
    if (bloc === undefined) {
      throw new Error(
        `use${displayName} must be used within a ${displayName}Provider`
      );
    }
    return bloc;
  }

  /**
   * Hook to subscribe to the bloc's state.
   *
   * Uses useSyncExternalStore for tear-resistant subscriptions.
   * Component re-renders whenever the bloc emits new state.
   */
  function useBlocState(): B extends Bloc<unknown, infer S> ? S : never {
    const bloc = useBloc();
    return useSyncExternalStore(
      (callback) => bloc.subscribe(callback),
      () => bloc.state
    ) as B extends Bloc<unknown, infer S> ? S : never;
  }

  /**
   * Hook to subscribe to a selected slice of the bloc's state.
   *
   * Use this for performance when you only need part of the state.
   * The selector should return a stable reference for objects/arrays.
   *
   * @example
   * const zoom = useBlocSelector((state) => state.viewState.zoom);
   */
  function useBlocSelector<T>(
    selector: (state: B extends Bloc<unknown, infer S> ? S : never) => T
  ): T {
    const bloc = useBloc();
    return useSyncExternalStore(
      (callback) => bloc.subscribe(callback),
      () => selector(bloc.state as B extends Bloc<unknown, infer S> ? S : never)
    );
  }

  return {
    Provider,
    useBloc,
    useBlocState,
    useBlocSelector,
    // Export context for advanced use cases (testing, nested providers)
    Context: BlocContext,
  };
}
