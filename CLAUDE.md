# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (Vite)
npm run build    # Type check + production build
npm run preview  # Preview production build
npm test         # Run tests in watch mode
npm run test:run # Run tests once (CI)
```

## Architecture

This is a React + TypeScript application for geospatial data visualization using deck.gl. It implements a **BLoC (Business Logic Component) pattern** inspired by Flutter's flutter_bloc package.

### BLoC Pattern

The core principle: **events flow in, state flows out**. Business logic lives in TypeScript classes, not React hooks.

```
Component ──(event)──> Bloc ──(state)──> Component
              │                    │
         bloc.add()          useBlocState()
```

**Key files:**
- `src/blocs/base_bloc.ts` — Abstract base class using Zustand internally for subscriptions
- `src/blocs/bloc_provider.tsx` — Factory for creating typed context providers (`createBlocProvider<B>()`)
- `src/hooks/use_bloc_state.ts` — Generic hooks (legacy; prefer provider-based hooks)

**Creating a new bloc:**
```
src/blocs/{feature}/
├── {feature}_bloc.ts      # Extends Bloc<Event, State>, implements add()
├── {feature}_bloc.test.ts # Unit tests (no React needed)
├── {feature}_event.ts     # Discriminated union type
├── {feature}_state.ts     # State type + initial state
├── {feature}_provider.tsx # Context provider via createBlocProvider()
└── index.ts               # Re-exports
```

Events use discriminated unions with a `type` field for exhaustive switch matching. Components are "dumb views" — they subscribe via `useBlocState(bloc)` and dispatch via `bloc.add({ type: '...' })`.

### Visualization Stack

- **deck.gl** — WebGL-powered data visualization layers
- **MapLibre GL** — Base map rendering (using CARTO dark-matter style)
- **react-map-gl** — React bindings for MapLibre

The `MapBloc` manages view state (longitude, latitude, zoom, pitch, bearing) and enabled layers. The `Map.tsx` component subscribes to this state and passes it to `DeckGL`.

### Styling

Tailwind CSS v4 with the Vite plugin. Import via `@import "tailwindcss"` in CSS files.
