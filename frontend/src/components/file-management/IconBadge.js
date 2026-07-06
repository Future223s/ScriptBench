"use client";

export function IconBadge({ kind, className = "" }) {
  const icons = {
    sampleSet: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 8h14M5 12h14M5 16h9" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        <path d="M7 4.8 4 6.4v10.8l3 1.5 3-1.5 3 1.5 3-1.5 3 1.5V6.4l-3-1.6-3 1.6-3-1.6-3 1.6z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    ),
    sample: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 6.5h10a2 2 0 0 1 2 2v8.2a2 2 0 0 1-2 2H8.5L4 21V8.5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M8 11h8M8 14h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
    group: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="7" cy="7" r="1.1" fill="currentColor" />
      </svg>
    ),
    trash: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 7h15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M9 7V5.8c0-.8.6-1.4 1.4-1.4h3.2c.8 0 1.4.6 1.4 1.4V7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M7.5 7.2l.6 11.3c0 .9.7 1.5 1.6 1.5h4.6c.9 0 1.6-.6 1.6-1.5l.6-11.3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 11v5M14 11v5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
    chevron: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  };

  return (
    <span className={["icon-badge", className].filter(Boolean).join(" ")} aria-hidden="true">
      {icons[kind] || null}
    </span>
  );
}
