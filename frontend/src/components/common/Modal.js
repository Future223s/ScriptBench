"use client";

export function Modal({ open = true, backdropClassName = "", panelClassName = "", children, ...props }) {
  if (!open) return null;

  return (
    <div className={["modal-backdrop", backdropClassName].filter(Boolean).join(" ")} {...props}>
      <section className={["modal", panelClassName].filter(Boolean).join(" ")}>
        {children}
      </section>
    </div>
  );
}
