# Granite Crisp - BLoC Architecture Demo

A React + TypeScript application demonstrating the **BLoC (Business Logic Component)** pattern for state management, built with deck.gl for geospatial visualization.

## Quick Start

```bash
npm install
npm run dev      # Start dev server at http://localhost:5173
npm run build    # Type check + production build
npm test         # Run tests in watch mode
npm run test:run # Run tests once (CI)
```

## Why BLoC?

The BLoC pattern separates business logic from UI, making code easier to test and reason about:

```
Component ──(event)──> Bloc ──(state)──> Component
              │                    │
         bloc.add()          useBlocState()
```

**Key benefits:**
- **Testable without React** — Blocs are plain TypeScript classes, tested with simple unit tests
- **Predictable state** — Events in, state out. No hidden side effects
- **Framework agnostic** — Business logic doesn't depend on React hooks or lifecycle

## Architecture

### Core Files

| File | Purpose |
|------|---------|
| `src/blocs/base_bloc.ts` | Abstract base class with Zustand-powered subscriptions |
| `src/blocs/bloc_provider.tsx` | Factory for creating typed React context providers |
| `src/hooks/use_bloc_state.ts` | Generic hooks for bloc subscription (legacy) |

### Bloc Structure

Each feature bloc follows this structure:

```
src/blocs/{feature}/
├── {feature}_bloc.ts      # Extends Bloc<Event, State>
├── {feature}_event.ts     # Discriminated union of events
├── {feature}_state.ts     # State type + initial state
├── {feature}_provider.tsx # React context provider + hooks
└── index.ts               # Re-exports
```

### Example Blocs

**MapBloc** — Synchronous state management
- View state (longitude, latitude, zoom, pitch, bearing)
- Layer visibility toggles
- Animated transitions (flyTo)

**AirQualityBloc** — Async data fetching with union states
- Service injection for testability
- Union state: `initial | loading | loaded | error`
- Demonstrates impossible-states-are-impossible pattern

## Usage

### 1. Wrap your app with providers

```tsx
// App.tsx
import { MapBloc, MapBlocProvider } from './blocs/map'
import { AirQualityBloc, AirQualityBlocProvider } from './blocs/air_quality'

const mapBloc = new MapBloc()
const airQualityBloc = new AirQualityBloc()

export default function App() {
  return (
    <MapBlocProvider bloc={mapBloc}>
      <AirQualityBlocProvider bloc={airQualityBloc}>
        <YourApp />
      </AirQualityBlocProvider>
    </MapBlocProvider>
  )
}
```

### 2. Use hooks in components

```tsx
// MyComponent.tsx
import { useMapBloc, useMapBlocState } from '../blocs/map'

function MyComponent() {
  // Get bloc for dispatching events
  const mapBloc = useMapBloc()

  // Subscribe to state changes
  const { viewState, enabledLayers } = useMapBlocState()

  // Dispatch events
  const handleClick = () => {
    mapBloc.add({ type: 'flyTo', longitude: -122.4, latitude: 37.8, zoom: 14 })
  }

  return <button onClick={handleClick}>Fly to SF</button>
}
```

### 3. Handle async/union states

```tsx
import { useAirQualityBlocState } from '../blocs/air_quality'

function DataView() {
  const state = useAirQualityBlocState()

  // Exhaustive switch - TypeScript ensures all cases handled
  switch (state.status) {
    case 'initial':
      return <button onClick={() => bloc.add({ type: 'load' })}>Load</button>
    case 'loading':
      return <Spinner />
    case 'loaded':
      return <DataTable data={state.data} />
    case 'error':
      return <Error message={state.message} />
  }
}
```

## Creating a New Bloc

### 1. Define events (discriminated union)

```typescript
// src/blocs/counter/counter_event.ts
export type CounterEvent =
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'set'; value: number }
```

### 2. Define state

```typescript
// src/blocs/counter/counter_state.ts
export type CounterState = {
  count: number
}

export const initialCounterState: CounterState = { count: 0 }
```

### 3. Implement the bloc

```typescript
// src/blocs/counter/counter_bloc.ts
import { Bloc } from '../base_bloc'
import type { CounterEvent } from './counter_event'
import type { CounterState } from './counter_state'
import { initialCounterState } from './counter_state'

export class CounterBloc extends Bloc<CounterEvent, CounterState> {
  constructor() {
    super(initialCounterState)
  }

  add(event: CounterEvent): void {
    switch (event.type) {
      case 'increment':
        this.emit({ count: this.state.count + 1 })
        break
      case 'decrement':
        this.emit({ count: this.state.count - 1 })
        break
      case 'set':
        this.emit({ count: event.value })
        break
    }
  }
}
```

### 4. Create provider

```typescript
// src/blocs/counter/counter_provider.tsx
import { createBlocProvider } from '../bloc_provider'
import type { CounterBloc } from './counter_bloc'

export const {
  Provider: CounterBlocProvider,
  useBloc: useCounterBloc,
  useBlocState: useCounterBlocState,
  useBlocSelector: useCounterBlocSelector,
} = createBlocProvider<CounterBloc>('CounterBloc')
```

## Testing

Blocs are tested without React — just plain TypeScript:

```typescript
// counter_bloc.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { CounterBloc } from './counter_bloc'

describe('CounterBloc', () => {
  let bloc: CounterBloc

  beforeEach(() => {
    bloc = new CounterBloc()
  })

  it('should increment', () => {
    bloc.add({ type: 'increment' })
    expect(bloc.state.count).toBe(1)
  })

  it('should decrement', () => {
    bloc.add({ type: 'decrement' })
    expect(bloc.state.count).toBe(-1)
  })
})
```

### Testing async blocs with service injection

```typescript
import { AirQualityBloc } from './air_quality_bloc'
import { MockAirQualityService } from '../../services/air_quality_service'

it('should load data', async () => {
  const mockService = new MockAirQualityService(mockData)
  const bloc = new AirQualityBloc(mockService)  // Inject mock

  bloc.add({ type: 'load' })

  await vi.waitFor(() => {
    expect(bloc.state.status).toBe('loaded')
  })
})
```

## Tech Stack

- **React 19** — UI framework
- **TypeScript** — Type safety
- **Vite** — Build tool
- **Zustand** — Internal subscription mechanism for blocs
- **deck.gl** — WebGL-powered data visualization
- **MapLibre GL** — Base map rendering
- **Tailwind CSS v4** — Styling
- **Vitest** — Testing

## Project Structure

```
src/
├── blocs/
│   ├── base_bloc.ts           # Abstract Bloc class
│   ├── bloc_provider.tsx      # Provider factory
│   ├── map/                   # MapBloc (sync)
│   │   ├── map_bloc.ts
│   │   ├── map_bloc.test.ts
│   │   ├── map_event.ts
│   │   ├── map_state.ts
│   │   ├── map_provider.tsx
│   │   └── index.ts
│   └── air_quality/           # AirQualityBloc (async)
│       ├── air_quality_bloc.ts
│       ├── air_quality_bloc.test.ts
│       ├── air_quality_event.ts
│       ├── air_quality_state.ts
│       ├── air_quality_provider.tsx
│       └── index.ts
├── components/
│   ├── Map.tsx                # deck.gl map view
│   └── ControlPanel.tsx       # UI controls
├── hooks/
│   └── use_bloc_state.ts      # Generic bloc hooks
├── services/
│   └── air_quality_service.ts # Data fetching + mock
└── App.tsx                    # Root with providers
```

## License

ISC
