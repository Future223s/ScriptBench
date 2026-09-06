"use client";

export function PageHeader({
  title,
  description,
  navigation,
  actions,
  className = "",
}) {
  return (
    <header className={["page-header", className].filter(Boolean).join(" ")}>
      <div className="page-header__copy">
        <h1 className="page-header__title">{title}</h1>
        {description ? (
          <p className="page-header__description">{description}</p>
        ) : null}
      </div>
      {navigation ? (
        <div className="page-header__navigation">{navigation}</div>
      ) : null}
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
