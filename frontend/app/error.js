"use client";

export default function Error({ error, reset }) {
  return (
    <main style={{ margin: 0, minHeight: "100vh", fontFamily: "system-ui, sans-serif", padding: "2rem", background: "#f7f1e8", color: "#261d18" }}>
      <h1 style={{ marginTop: 0 }}>Something went wrong</h1>
      <p style={{ maxWidth: "42rem" }}>
        The app hit a rendering error. You can retry, and if it keeps happening we should inspect the console for the underlying cause.
      </p>
      <pre style={{ whiteSpace: "pre-wrap", background: "#fffdf8", padding: "1rem", border: "1px solid rgba(79, 58, 43, 0.14)", borderRadius: "8px" }}>
        {error?.message || String(error)}
      </pre>
      <button type="button" onClick={() => reset()} style={{ marginTop: "1rem" }}>
        Retry
      </button>
    </main>
  );
}
