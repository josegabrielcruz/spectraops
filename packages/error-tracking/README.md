# @spectraops/error-tracking

Lightweight, zero-dependency error-tracking SDK for **SpectraOps**.  
Captures unhandled errors and promise rejections in the browser, batches them, and delivers them to the SpectraOps API.

## Installation

```bash
# npm
npm install @spectraops/error-tracking

# pnpm
pnpm add @spectraops/error-tracking
```

## Quick Start

```ts
import { init, captureError } from '@spectraops/error-tracking';

init({
  endpoint: 'https://your-spectraops-api.example.com',
  apiKey: 'your-project-api-key',
});

// Errors are now captured automatically via window.onerror
// and unhandledrejection handlers.

// You can also capture errors manually:
try {
  riskyOperation();
} catch (err) {
  captureError(err as Error);
}
```

## Configuration

Pass a config object to `init()`:

| Option          | Type      | Default | Description                                                      |
| --------------- | --------- | ------- | ---------------------------------------------------------------- |
| `endpoint`      | `string`  | —       | **Required.** URL of the SpectraOps API.                         |
| `apiKey`        | `string`  | —       | API key (from the `projects` table) for authenticated ingestion. |
| `batchSize`     | `number`  | `10`    | Number of queued errors before an automatic flush.               |
| `flushInterval` | `number`  | `5000`  | Milliseconds between automatic flushes.                          |
| `debug`         | `boolean` | `false` | When `true`, captured errors are also logged to the console.     |

## API

### `init(config: SpectraOpsConfig): void`

Initialize the SDK. Must be called once, before any other function.

- Starts the auto-flush timer.
- Registers `window.error` and `unhandledrejection` listeners (browser only).
- Registers `visibilitychange` and `pagehide` listeners to flush remaining errors when the page is hidden or closed (uses `fetch` with `keepalive: true` to reliably deliver during unload).

### `captureError(error: Error): void`

Manually capture an `Error` instance. The error is queued and sent on the next
flush (or immediately when the queue reaches `batchSize`).

### `flush(): Promise<void>`

Immediately send all queued errors to the API as a single batch request
(`POST /api/errors/batch`). Called automatically by the timer and when the
batch threshold is reached. Failed batches are re-queued so data is not lost.

Each error payload automatically includes a `timestamp` (ISO 8601) captured at
the moment `captureError()` was called, preserving accurate client-side timing
even when errors are queued or retried.

### `destroy(): void`

Stop the auto-flush timer, remove all global listeners (`error`,
`unhandledrejection`, `pagehide`, `visibilitychange`), and clear the queue.
Call this during cleanup (e.g., when your SPA unmounts).

## Framework Examples

### React (with Error Boundary)

```tsx
// src/main.tsx
import { init } from '@spectraops/error-tracking';

init({
  endpoint: import.meta.env.VITE_API_URL,
  apiKey: import.meta.env.VITE_SPECTRAOPS_KEY,
});
```

```tsx
// src/ErrorBoundary.tsx
import { Component, type ReactNode } from 'react';
import { captureError } from '@spectraops/error-tracking';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    captureError(error);
  }

  render() {
    return this.state.hasError ? (
      <h1>Something went wrong.</h1>
    ) : (
      this.props.children
    );
  }
}
```

### Vanilla JavaScript

```html
<script type="module">
  import { init } from '@spectraops/error-tracking';

  init({
    endpoint: 'https://your-spectraops-api.example.com',
    apiKey: 'your-project-api-key',
  });
</script>
```

## Obtaining an API Key

Each project in SpectraOps has a unique API key.

1. **Dashboard** — Log in, go to the "Projects & API Keys" tab, and click "Create Project". Copy the generated API key.
2. **API** — `POST /api/projects` with a valid session token:
   ```bash
   curl -X POST http://localhost:3000/api/projects \
     -H 'Authorization: Bearer <session-token>' \
     -H 'Content-Type: application/json' \
     -d '{"name": "my-app"}'
   ```
   The response includes the auto-generated `api_key`.

Pass this key as the `apiKey` option when calling `init()`.

## License

MIT
