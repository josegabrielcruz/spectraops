import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchProjects,
  createProject,
  deleteProject,
  rotateApiKey,
  type Project,
} from '../api/projects';

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchProjects()
      .then(setProjects)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createProject(newName.trim());
      setNewName('');
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this project and all its error data?')) return;
    try {
      await deleteProject(id);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleRotate = async (id: number) => {
    if (
      !confirm(
        'Regenerate the API key? The old key will stop working immediately.',
      )
    )
      return;
    try {
      const updated = await rotateApiKey(id);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === updated.id ? { ...p, api_key: updated.api_key } : p,
        ),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to rotate key');
    }
  };

  const copyKey = (project: Project) => {
    navigator.clipboard.writeText(project.api_key);
    setCopiedId(project.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
        <span className="ml-3 text-gray-500">Loading projects…</span>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Projects</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 text-sm rounded flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => {
              setError(null);
              load();
            }}
            className="ml-3 px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Create project form */}
      <form onSubmit={handleCreate} className="flex gap-2 mb-6">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New project name"
          required
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={creating}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {creating ? 'Creating...' : 'Create'}
        </button>
      </form>

      {projects.length === 0 ? (
        <p className="text-gray-500">
          No projects yet. Create one to get an API key for the SDK.
        </p>
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => (
            <li
              key={project.id}
              className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-lg">{project.name}</span>
                <span className="text-xs text-gray-400">
                  {new Date(project.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <code className="flex-1 text-xs bg-gray-100 px-2 py-1 rounded font-mono truncate">
                  {project.api_key}
                </code>
                <button
                  onClick={() => copyKey(project)}
                  className="text-xs px-2 py-1 border rounded hover:bg-gray-50 transition"
                >
                  {copiedId === project.id ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleRotate(project.id)}
                  className="text-xs px-2 py-1 text-amber-700 border border-amber-300 bg-amber-50 rounded hover:bg-amber-100 transition"
                >
                  Rotate Key
                </button>
                <button
                  onClick={() => handleDelete(project.id)}
                  className="text-xs px-2 py-1 text-red-700 border border-red-300 bg-red-50 rounded hover:bg-red-100 transition"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
