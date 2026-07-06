"use client";

export function Panel({ as: Component = "section", className = "", children, ...props }) {
  return (
    <Component className={["panel", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </Component>
  );
}
