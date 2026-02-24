import React, { useEffect, useState } from 'react';
import {
  fetchErrors,
  type ErrorEvent,
  type PaginatedErrors,
} from '../api/errors';

export default function ErrorList() {
  const [errors, setErrors] = useState<ErrorEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = (p: number) => {
    setLoading(true);
    setError(null);
    fetchErrors({ page: p })
      .then((result: PaginatedErrors) => {
        setErrors(result.data);
        setTotalPages(result.pagination.totalPages);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(page);
  }, [page]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
        <span className="ml-3 text-gray-500">Loading errors…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block p-3 bg-red-100 rounded-full mb-3">
          <svg
            className="h-6 w-6 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-red-600 text-sm mb-3">{error}</p>
        <button
          onClick={() => load(page)}
          className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Errors</h2>
      {errors.length === 0 ? (
        <p className="text-gray-500">No errors recorded.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {errors.map((err) => (
              <li
                key={err.id}
                className="bg-white border border-gray-200 p-3 rounded-lg shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                      err.severity === 'fatal'
                        ? 'bg-purple-200 text-purple-900'
                        : err.severity === 'error'
                          ? 'bg-red-200 text-red-800'
                          : err.severity === 'warning'
                            ? 'bg-yellow-200 text-yellow-800'
                            : 'bg-blue-200 text-blue-800'
                    }`}
                  >
                    {err.severity}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="inline-block px-2 py-0.5 text-xs rounded bg-gray-200 text-gray-700">
                      {err.environment}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(err.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="font-mono text-sm mt-2">{err.message}</div>
                {err.stack && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      Stack trace
                    </summary>
                    <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                      {err.stack}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 border rounded disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 border rounded disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
