export interface SpectraOpsConfig {
  /** The URL of the SpectraOps API (e.g. "https://your-host:3000") */
  endpoint: string;
  /** Optional API key for authenticated ingestion */
  apiKey?: string;
  /** Max queued errors before forcing a flush (default: 10) */
  batchSize?: number;
  /** Interval in ms to auto-flush the queue (default: 5000) */
  flushInterval?: number;
  /** Whether to also log captured errors to the console (default: false) */
  debug?: boolean;
}

interface ErrorPayload {
  message: string;
  stack?: string;
  source_url?: string;
  user_agent?: string;
  timestamp: string;
}

let _config: SpectraOpsConfig | null = null;
let _queue: ErrorPayload[] = [];
let _timer: ReturnType<typeof setInterval> | null = null;
let _errorHandler: ((event: ErrorEvent) => void) | null = null;
let _rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;
let _unloadHandler: (() => void) | null = null;
let _visibilityHandler: (() => void) | null = null;

/**
 * Initialize the SpectraOps error-tracking client.
 * Must be called before `captureError`.
 */
export function init(config: SpectraOpsConfig): void {
  // Clean up previous init if any
  destroy();

  _config = {
    batchSize: 10,
    flushInterval: 5000,
    debug: false,
    ...config,
  };

  // Start auto-flush timer
  _timer = setInterval(() => {
    flush();
  }, _config.flushInterval);

  // Register global error handlers when running in a browser
  if (typeof window !== 'undefined') {
    _errorHandler = (event: ErrorEvent) => {
      captureError(event.error ?? new Error(event.message));
    };
    _rejectionHandler = (event: PromiseRejectionEvent) => {
      const error =
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason));
      captureError(error);
    };
    window.addEventListener('error', _errorHandler);
    window.addEventListener('unhandledrejection', _rejectionHandler);

    // Flush remaining errors when the page is being unloaded.
    // Uses fetch with keepalive (supports custom headers, unlike sendBeacon).
    _unloadHandler = () => {
      if (!_config || _queue.length === 0) return;
      const url = `${_config.endpoint}/api/errors/batch`;
      const batch = _queue.splice(0);
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(_config.apiKey ? { 'x-api-key': _config.apiKey } : {}),
        },
        body: JSON.stringify({ errors: batch }),
        keepalive: true,
      }).catch(() => {});
    };
    _visibilityHandler = () => {
      if (document.visibilityState === 'hidden' && _unloadHandler) {
        _unloadHandler();
      }
    };
    document.addEventListener('visibilitychange', _visibilityHandler);
    window.addEventListener('pagehide', _unloadHandler);
  }
}

/**
 * Capture an error and queue it for delivery to the SpectraOps API.
 */
export function captureError(error: Error): void {
  if (!_config) {
    console.warn(
      '[SpectraOps] Client not initialised. Call init() before captureError().',
    );
    return;
  }

  const payload: ErrorPayload = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    ...(typeof window !== 'undefined' && {
      source_url: window.location.href,
      user_agent: navigator.userAgent,
    }),
  };

  if (_config.debug) {
    console.error('[SpectraOps] Error captured:', error);
  }

  _queue.push(payload);

  if (_queue.length >= (_config.batchSize ?? 10)) {
    flush();
  }
}

/**
 * Immediately send all queued errors to the API via batch endpoint.
 */
export async function flush(): Promise<void> {
  if (!_config || _queue.length === 0) return;

  const batch = _queue.splice(0);
  const url = `${_config.endpoint}/api/errors/batch`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (_config.apiKey) {
    headers['x-api-key'] = _config.apiKey;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ errors: batch }),
    });
    if (!res.ok) {
      // Re-queue on server error so data is not lost
      _queue.push(...batch);
    }
  } catch (err) {
    if (_config?.debug) {
      console.error('[SpectraOps] Failed to send errors:', err);
    }
    // Re-queue on network failure so data is not lost
    _queue.push(...batch);
  }
}

/**
 * Tear down the client — stop the flush timer and clear the queue.
 * Useful for tests and cleanup.
 */
export function destroy(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  if (typeof window !== 'undefined') {
    if (_errorHandler) {
      window.removeEventListener('error', _errorHandler);
      _errorHandler = null;
    }
    if (_rejectionHandler) {
      window.removeEventListener('unhandledrejection', _rejectionHandler);
      _rejectionHandler = null;
    }
    if (_unloadHandler) {
      window.removeEventListener('pagehide', _unloadHandler);
      _unloadHandler = null;
    }
    if (_visibilityHandler) {
      document.removeEventListener('visibilitychange', _visibilityHandler);
      _visibilityHandler = null;
    }
  }
  _queue = [];
  _config = null;
}
