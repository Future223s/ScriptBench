"use client";

export function Badge({ children, className = "", title, ...props }) {
  return (
    <span className={["badge", className].filter(Boolean).join(" ")} title={title} {...props}>
      {children}
    </span>
  );
}
