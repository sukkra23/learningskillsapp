import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
/** Shown when a route throws: a 404 from a guard, or an unexpected rendering error. */
export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;
  return (
    <div className="card mx-auto max-w-lg text-center" role="alert">
      <h1 className="text-2xl">Something went wrong</h1>
      <p className="mt-2 text-muted">This page hit an error. Your progress is safe. Try reloading, or go back home.</p>
      <div className="mt-4 flex justify-center gap-2"><button type="button" className="btn" onClick={() => window.location.reload()}>Reload</button><Link to="/" className="btn btn-primary">Go home</Link></div>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="card mx-auto max-w-lg text-center">
      <h1 className="text-2xl">Page not found</h1>
      <p className="mt-2 text-muted">That address does not match any topic or page.</p>
      <Link to="/" className="btn btn-primary mt-4">Go home</Link>
    </div>
  );
}
