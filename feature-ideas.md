1. Bloc-to-bloc communication
   AirQualityBloc reloads when map viewport changes. Shows how blocs coordinate without coupling.
2. Undo/Redo for map state
   Event sourcing pattern - keep history, navigate back/forward. Hard to do cleanly with hooks.
3. Real-time streaming data
   WebSocket or mock stream pushing live AQI updates. Shows how blocs handle continuous events.
4. Middleware/interceptors
   Logging, analytics, or error tracking that wraps all bloc events. Cross-cutting concerns pattern.
