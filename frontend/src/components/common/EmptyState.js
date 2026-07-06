"use client";

export function EmptyState({ children, className = "", ...props }) {
  return (
    <div className={["empty-state", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </div>
  );
}
