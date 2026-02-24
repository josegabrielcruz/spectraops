// Fetch errors from the SpectraOps backend API
// In dev, relative URLs are proxied by Vite. In production, set VITE_API_URL at build time.
const API_BASE = import.meta.env.VITE_API_URL || '';

export interface ErrorEvent {
  id: number;
  project_id: number | null;
  message: string;
  stack: string | null;
  source_url: string | null;
  user_agent: string | null;
  environment: string;
  severity: string;
  client_timestamp: string | null;
  created_at: string;
}

export interface PaginatedErrors {
  data: ErrorEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('spectraops_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchErrors(
  opts: { page?: number; limit?: number } = {},
): Promise<PaginatedErrors> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 50;

  const res = await fetch(
    `${API_BASE}/api/errors?page=${page}&limit=${limit}`,
    { headers: authHeaders() },
  );
  if (res.status === 401) {
    // Session expired — notify AuthContext via custom event
    localStorage.removeItem('spectraops_token');
    window.dispatchEvent(new CustomEvent('spectraops:unauthorized'));
    throw new Error('Session expired');
  }
  if (!res.ok) throw new Error('Failed to fetch errors');
  return await res.json();
}
