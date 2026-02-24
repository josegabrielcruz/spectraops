// Dashboard API client for project management
// In dev, relative URLs are proxied by Vite. In production, set VITE_API_URL at build time.
const API_BASE = import.meta.env.VITE_API_URL || '';

export interface Project {
  id: number;
  name: string;
  api_key: string;
  created_at: string;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('spectraops_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handleResponse(res: Response): void {
  if (res.status === 401) {
    localStorage.removeItem('spectraops_token');
    window.dispatchEvent(new CustomEvent('spectraops:unauthorized'));
    throw new Error('Session expired');
  }
}

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(`${API_BASE}/api/projects`, {
    headers: authHeaders(),
  });
  handleResponse(res);
  if (!res.ok) throw new Error('Failed to fetch projects');
  const body = await res.json();
  return body.data;
}

export async function createProject(name: string): Promise<Project> {
  const res = await fetch(`${API_BASE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name }),
  });
  handleResponse(res);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || 'Failed to create project');
  }
  const body = await res.json();
  return body.data;
}

export async function deleteProject(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  handleResponse(res);
  if (!res.ok) throw new Error('Failed to delete project');
}

export async function rotateApiKey(id: number): Promise<Project> {
  const res = await fetch(`${API_BASE}/api/projects/${id}/rotate-key`, {
    method: 'POST',
    headers: authHeaders(),
  });
  handleResponse(res);
  if (!res.ok) throw new Error('Failed to rotate API key');
  const body = await res.json();
  return body.data;
}
