import { MapView } from "./components/Map";
import { ControlPanel } from "./components/ControlPanel";
import { MultiBlocProvider } from "./blocs/bloc_provider";
import { MapBloc, MapBlocProvider } from "./blocs/map";
import { AirQualityBloc, AirQualityBlocProvider } from "./blocs/air_quality";
import { Sf311Bloc, Sf311BlocProvider } from "./blocs/sf311";

const mapBloc = new MapBloc();
const airQualityBloc = new AirQualityBloc();
const sf311Bloc = new Sf311Bloc();

// Wire up bloc-to-bloc communication
// AirQualityBloc will reload data when map viewport changes significantly
airQualityBloc.connectToMap(mapBloc);

export default function App() {
  return (
    <MultiBlocProvider
      blocs={[
        { Provider: MapBlocProvider, bloc: mapBloc },
        { Provider: AirQualityBlocProvider, bloc: airQualityBloc },
        { Provider: Sf311BlocProvider, bloc: sf311Bloc },
      ]}
    >
      <div className="w-full h-full relative">
        <MapView />
        <ControlPanel />
      </div>
    </MultiBlocProvider>
  );
}
