// Fetch errors from the SpectraOps backend API
export async function fetchErrors() {
  const res = await fetch('http://localhost:3000/api/errors');
  if (!res.ok) throw new Error('Failed to fetch errors');
  return await res.json();
}
