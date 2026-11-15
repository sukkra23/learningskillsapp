import { Link } from 'react-router-dom';
export function NotFound() {
  return (
    <div className="card mx-auto max-w-lg text-center">
      <h1 className="text-2xl">Page not found</h1>
      <p className="mt-2 text-muted">That address does not match any topic or page.</p>
      <Link to="/" className="btn btn-primary mt-4">Go home</Link>
    </div>
  );
}
