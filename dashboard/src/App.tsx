import React, { useState } from 'react';
import { useAuth } from './auth/AuthContext';
import ErrorList from './components/ErrorList';
import ProjectList from './components/ProjectList';
import LoginForm from './components/LoginForm';

type Tab = 'errors' | 'projects';

function App() {
  const { user, loading, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('errors');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="p-4 bg-white shadow flex items-center justify-between">
        <h1 className="text-3xl font-bold text-blue-600">
          SpectraOps Dashboard
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user.email}</span>
          <button
            onClick={logout}
            className="text-sm text-red-600 hover:underline"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Tab navigation */}
      <nav className="max-w-3xl mx-auto mt-6 flex gap-1 border-b border-gray-300">
        <button
          onClick={() => setTab('errors')}
          className={`px-4 py-2 text-sm font-medium rounded-t-md transition ${
            tab === 'errors'
              ? 'bg-white border border-b-white border-gray-300 text-blue-600 -mb-px'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Errors
        </button>
        <button
          onClick={() => setTab('projects')}
          className={`px-4 py-2 text-sm font-medium rounded-t-md transition ${
            tab === 'projects'
              ? 'bg-white border border-b-white border-gray-300 text-blue-600 -mb-px'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Projects &amp; API Keys
        </button>
      </nav>

      <main className="max-w-3xl mx-auto mt-4">
        {tab === 'errors' ? <ErrorList /> : <ProjectList />}
      </main>
    </div>
  );
}

export default App;
