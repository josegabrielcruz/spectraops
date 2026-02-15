// Fetch errors from the SpectraOps backend API
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ErrorEvent {
  id: number;
  message: string;
  stack: string | null;
  created_at: string;
}

export async function fetchErrors(): Promise<ErrorEvent[]> {
  const res = await fetch(`${API_BASE}/api/errors`);
  if (!res.ok) throw new Error('Failed to fetch errors');
  return await res.json();
}
