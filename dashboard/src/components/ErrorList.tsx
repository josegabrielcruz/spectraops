import React, { useEffect, useState } from 'react';
import { fetchErrors, type ErrorEvent } from '../api/errors';

export default function ErrorList() {
  const [errors, setErrors] = useState<ErrorEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchErrors()
      .then(setErrors)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-4 text-gray-500">Loading errors...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Errors</h2>
      {errors.length === 0 ? (
        <p className="text-gray-500">No errors recorded.</p>
      ) : (
        <ul className="space-y-2">
          {errors.map((err) => (
            <li key={err.id} className="bg-red-100 p-2 rounded">
              <div className="font-mono text-sm">{err.message}</div>
              <div className="text-xs text-gray-500">{err.created_at}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
