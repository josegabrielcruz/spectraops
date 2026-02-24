# Error Tracking Flow

1. The client SDK captures errors, batches them, and sends them to the SpectraOps API (`POST /api/errors/batch`).
2. The API receives and stores errors in the database.
3. The dashboard fetches and displays errors for review.

## Setup

- Start the core engine API server.
- Use the client SDK to capture errors in your app.
- View errors in the dashboard.

## Example

```js
import { captureError } from '@spectraops/error-tracking';

try {
  // ...some code
} catch (e) {
  captureError(e);
}
```
