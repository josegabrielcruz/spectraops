import React, { useEffect, useState } from 'react';
import { fetchErrors } from '../api/errors';

export default function ErrorList() {
  const [errors, setErrors] = useState<any[]>([]);

  useEffect(() => {
    fetchErrors().then(setErrors);
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Errors</h2>
      <ul className="space-y-2">
        {errors.map((err) => (
          <li key={err.id} className="bg-red-100 p-2 rounded">
            <div className="font-mono text-sm">{err.message}</div>
            <div className="text-xs text-gray-500">{err.timestamp}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
