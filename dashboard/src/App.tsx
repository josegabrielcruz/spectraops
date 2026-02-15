import React from 'react';
import ErrorList from './components/ErrorList';

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="p-4 bg-white shadow">
        <h1 className="text-3xl font-bold text-blue-600">
          SpectraOps Dashboard
        </h1>
      </header>
      <main className="max-w-2xl mx-auto mt-8">
        <ErrorList />
      </main>
    </div>
  );
}

export default App;
