# React BLoC Architecture Plan

A plan for implementing flutter_bloc-style state management in React with TypeScript.

## Goals

- Typed events in, typed state out
- Business logic isolated in testable classes (no hooks)
- Components are dumb views that subscribe to state and dispatch events
- No dependency array hell, no useMemo/useCallback ceremony
- Predictable, traceable data flow

## Core Concepts Mapping

| Flutter BLoC         | React Implementation                                   |
| -------------------- | ------------------------------------------------------ |
| `Bloc<Event, State>` | TypeScript class with event handler and state emitter  |
| `BlocProvider`       | React context or module-level singleton                |
| `BlocBuilder`        | Custom `useBlocState()` hook or observer component     |
| `bloc.add(event)`    | Same pattern, typed event dispatch                     |
| `emit(state)`        | Update internal store, notify subscribers              |
| `Stream<State>`      | Zustand store, RxJS BehaviorSubject, or custom pub/sub |

## Architecture Decision: State Layer

### Option A: Zustand (Recommended)

**Pros:**

- Minimal API, no boilerplate
- Built-in subscription optimization
- Works outside React (can use in bloc classes)
- Good TypeScript support

**Cons:**

- Another dependency (though tiny, ~1kb)

### Option B: useSyncExternalStore + Custom Store

**Pros:**

- Zero dependencies
- React 18+ native

**Cons:**

- More manual wiring
- Must implement subscription logic yourself

### Option C: RxJS

**Pros:**

- True stream semantics (faithful to flutter_bloc)
- Powerful operators (debounce, switchMap, etc.)

**Cons:**

- Heavy dependency
- Learning curve if team doesn't know RxJS

**Recommendation:** Start with Zustand for simplicity. Can swap to RxJS later if stream operators become necessary.

## Project Structure

```
src/
├── blocs/
│   ├── counter/
│   │   ├── counter_bloc.ts
│   │   ├── counter_event.ts
│   │   ├── counter_state.ts
│   │   └── index.ts
│   └── auth/
│       ├── auth_bloc.ts
│       ├── auth_event.ts
│       ├── auth_state.ts
│       └── index.ts
├── hooks/
│   └── use_bloc_state.ts      # Single thin hook for subscriptions
├── components/
│   └── ...                     # Dumb view components
├── services/
│   └── ...                     # API clients, external integrations
└── App.tsx
```

## Implementation Phases

### Phase 1: Core Infrastructure

1. **Define base types**

   ```typescript
   // types/bloc.ts
   type Listener<S> = (state: S) => void;

   interface Bloc<E, S> {
     state: S;
     add(event: E): void;
     subscribe(listener: Listener<S>): () => void;
   }
   ```

2. **Create base bloc class**

   ```typescript
   // blocs/base_bloc.ts
   import { create, StoreApi } from "zustand";

   export abstract class Bloc<E, S> {
     private store: StoreApi<S>;

     constructor(initialState: S) {
       this.store = create<S>(() => initialState);
     }

     get state(): S {
       return this.store.getState();
     }

     protected emit(state: S | Partial<S>): void {
       this.store.setState(state as S);
     }

     subscribe(listener: (state: S) => void): () => void {
       return this.store.subscribe(listener);
     }

     abstract add(event: E): void;
   }
   ```

3. **Create useBlocState hook**

   ```typescript
   // hooks/use_bloc_state.ts
   import { useSyncExternalStore } from "react";
   import type { Bloc } from "../blocs/base_bloc";

   export function useBlocState<E, S>(bloc: Bloc<E, S>): S {
     return useSyncExternalStore(
       (callback) => bloc.subscribe(callback),
       () => bloc.state
     );
   }

   // Optional: selector version to avoid re-renders
   export function useBlocSelector<E, S, T>(
     bloc: Bloc<E, S>,
     selector: (state: S) => T
   ): T {
     return useSyncExternalStore(
       (callback) => bloc.subscribe(callback),
       () => selector(bloc.state)
     );
   }
   ```

### Phase 2: Example Bloc Implementation

1. **Define events (discriminated union)**

   ```typescript
   // blocs/counter/counter_event.ts
   export type CounterEvent =
     | { type: "increment" }
     | { type: "decrement" }
     | { type: "reset" }
     | { type: "set"; value: number };
   ```

2. **Define state**

   ```typescript
   // blocs/counter/counter_state.ts
   export type CounterState = {
     count: number;
     lastUpdated: Date | null;
   };

   export const initialCounterState: CounterState = {
     count: 0,
     lastUpdated: null,
   };
   ```

3. **Implement bloc**

   ```typescript
   // blocs/counter/counter_bloc.ts
   import { Bloc } from "../base_bloc";
   import type { CounterEvent } from "./counter_event";
   import type { CounterState } from "./counter_state";
   import { initialCounterState } from "./counter_state";

   export class CounterBloc extends Bloc<CounterEvent, CounterState> {
     constructor() {
       super(initialCounterState);
     }

     add(event: CounterEvent): void {
       switch (event.type) {
         case "increment":
           this.emit({
             count: this.state.count + 1,
             lastUpdated: new Date(),
           });
           break;
         case "decrement":
           this.emit({
             count: this.state.count - 1,
             lastUpdated: new Date(),
           });
           break;
         case "reset":
           this.emit(initialCounterState);
           break;
         case "set":
           this.emit({
             count: event.value,
             lastUpdated: new Date(),
           });
           break;
       }
     }
   }
   ```

4. **Use in component**

   ```typescript
   // components/Counter.tsx
   import { useBlocState } from "../hooks/use_bloc_state";
   import { counterBloc } from "../blocs/counter";

   export function Counter() {
     const state = useBlocState(counterBloc);

     return (
       <div>
         <p>Count: {state.count}</p>
         <button onClick={() => counterBloc.add({ type: "increment" })}>
           +
         </button>
         <button onClick={() => counterBloc.add({ type: "decrement" })}>
           -
         </button>
       </div>
     );
   }
   ```

### Phase 3: Async Events

Handle async operations (API calls, etc.) within the bloc:

```typescript
// blocs/auth/auth_event.ts
export type AuthEvent =
  | { type: "login"; email: string; password: string }
  | { type: "logout" }
  | { type: "checkSession" };

// blocs/auth/auth_state.ts
export type AuthState =
  | { status: "initial" }
  | { status: "loading" }
  | { status: "authenticated"; user: User }
  | { status: "unauthenticated" }
  | { status: "error"; message: string };

// blocs/auth/auth_bloc.ts
export class AuthBloc extends Bloc<AuthEvent, AuthState> {
  constructor(private authService: AuthService) {
    super({ status: "initial" });
  }

  add(event: AuthEvent): void {
    switch (event.type) {
      case "login":
        this.handleLogin(event.email, event.password);
        break;
      case "logout":
        this.handleLogout();
        break;
      // ...
    }
  }

  private async handleLogin(email: string, password: string): Promise<void> {
    this.emit({ status: "loading" });

    try {
      const user = await this.authService.login(email, password);
      this.emit({ status: "authenticated", user });
    } catch (e) {
      this.emit({ status: "error", message: e.message });
    }
  }
}
```

### Phase 4: Bloc Providers (Optional)

For dependency injection or scoped blocs:

```typescript
// context/bloc_provider.tsx
import { createContext, useContext, ReactNode } from "react";

function createBlocProvider<B>(name: string) {
  const Context = createContext<B | null>(null);

  function Provider({ bloc, children }: { bloc: B; children: ReactNode }) {
    return <Context.Provider value={bloc}>{children}</Context.Provider>;
  }

  function useBloc(): B {
    const bloc = useContext(Context);
    if (!bloc) throw new Error(`${name} not found in context`);
    return bloc;
  }

  return { Provider, useBloc };
}

// Usage
export const { Provider: AuthBlocProvider, useBloc: useAuthBloc } =
  createBlocProvider<AuthBloc>("AuthBloc");
```

### Phase 5: Testing

Blocs are plain TypeScript classes—test without React:

```typescript
// blocs/counter/counter_bloc.test.ts
describe("CounterBloc", () => {
  let bloc: CounterBloc;

  beforeEach(() => {
    bloc = new CounterBloc();
  });

  it("increments count", () => {
    bloc.add({ type: "increment" });
    expect(bloc.state.count).toBe(1);
  });

  it("decrements count", () => {
    bloc.add({ type: "set", value: 5 });
    bloc.add({ type: "decrement" });
    expect(bloc.state.count).toBe(4);
  });

  it("notifies subscribers", () => {
    const listener = vi.fn();
    bloc.subscribe(listener);

    bloc.add({ type: "increment" });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ count: 1 })
    );
  });
});
```

## Future Enhancements

- **Event transformers** — Debounce, throttle, or queue events (add RxJS if needed)
- **Middleware/logging** — Intercept events and state changes for debugging
- **Persistence** — Hydrate blocs from localStorage/IndexedDB
- **DevTools** — Build a simple inspector showing event history and state snapshots

## Dependencies

Minimal:

```json
{
  "dependencies": {
    "react": "^18.x",
    "zustand": "^4.x"
  }
}
```

Optional (if stream operators needed):

```json
{
  "dependencies": {
    "rxjs": "^7.x"
  }
}
```

## Summary

This architecture gives you:

1. **Typed events** — Discriminated unions with exhaustive matching
2. **Typed state** — Including union states for async flows
3. **Isolated logic** — Blocs are testable without React
4. **Dumb components** — Subscribe and dispatch, nothing else
5. **No hook complexity** — One simple `useBlocState()` hook, no dependency arrays
