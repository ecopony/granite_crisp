import { createBlocProvider } from "@granite-crisp/react-bloc";
import type { MapBloc } from "./map_bloc";

/**
 * MapBloc Provider and hooks.
 *
 * Created via factory to ensure consistent API across all blocs.
 *
 * @example
 * // Wrap your app or subtree
 * <MapBlocProvider bloc={new MapBloc()}>
 *   <MapView />
 * </MapBlocProvider>
 *
 * // In child components
 * const mapBloc = useMapBloc();
 * const { viewState } = useMapBlocState();
 * mapBloc.add({ type: "setZoom", zoom: 12 });
 */
export const {
  Provider: MapBlocProvider,
  useBloc: useMapBloc,
  useBlocState: useMapBlocState,
  useBlocSelector: useMapBlocSelector,
  Context: MapBlocContext,
} = createBlocProvider<MapBloc>("MapBloc");
