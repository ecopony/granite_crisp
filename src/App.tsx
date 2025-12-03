import { MapView } from './components/Map'
import { ControlPanel } from './components/ControlPanel'
import { MapBloc, MapBlocProvider } from './blocs/map'
import { AirQualityBloc, AirQualityBlocProvider } from './blocs/air_quality'

const mapBloc = new MapBloc()
const airQualityBloc = new AirQualityBloc()

// Wire up bloc-to-bloc communication
// AirQualityBloc will reload data when map viewport changes significantly
airQualityBloc.connectToMap(mapBloc)

export default function App() {
  return (
    <MapBlocProvider bloc={mapBloc}>
      <AirQualityBlocProvider bloc={airQualityBloc}>
        <div className="w-full h-full relative">
          <MapView />
          <ControlPanel />
        </div>
      </AirQualityBlocProvider>
    </MapBlocProvider>
  )
}
