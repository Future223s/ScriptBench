"use client";

import { useEffect, useId, useRef, useState } from "react";

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

const buttonVariants = new Set(["primary", "secondary", "danger"]);

export function Button({
  variant = "secondary",
  size = "default",
  type = "button",
  children,
  className: _className,
  style: _style,
  ...props
}) {
  const resolvedVariant = buttonVariants.has(variant) ? variant : "secondary";
  return (
    <button
      {...props}
      type={type}
      className={joinClasses(
        "ui-button",
        `ui-button--${resolvedVariant}`,
        `ui-button--${size}`,
      )}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  variant = "ghost",
  disabled = false,
  onClick,
}) {
  return (
    <button
      type="button"
      className={joinClasses("ui-icon-button", `ui-icon-button--${variant}`)}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const iconPaths = {
  add: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  delete: <path d="M5 7h14M10 7V5h4v2M8 7l1 12h6l1-12" />,
  chevron: <path d="m7 10 5 5 5-5" />,
  zoomIn: (
    <>
      <circle cx="10" cy="10" r="5" />
      <path d="M10 7v6M7 10h6M14 14l5 5" />
    </>
  ),
  zoomOut: (
    <>
      <circle cx="10" cy="10" r="5" />
      <path d="M7 10h6M14 14l5 5" />
    </>
  ),
  fit: (
    <>
      <path d="M5 9V5h4M15 5h4v4M19 15v4h-4M9 19H5v-4" />
      <rect x="8" y="8" width="8" height="8" rx="1" />
    </>
  ),
};

export function Icon({ name, label }) {
  return (
    <svg
      className="ui-icon"
      viewBox="0 0 24 24"
      role={label ? "img" : "presentation"}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name] || null}
    </svg>
  );
}

export function Field({
  label,
  hint,
  error,
  action,
  children,
  density = "default",
}) {
  return (
    <label className={joinClasses("ui-field", `ui-field--${density}`)}>
      <span className="ui-field__header">
        <span className="ui-field__label">{label}</span>
        {action ? <span className="ui-field__action">{action}</span> : null}
      </span>
      {children}
      {error ? (
        <span className="ui-field__error">{error}</span>
      ) : hint ? (
        <span className="ui-field__hint">{hint}</span>
      ) : null}
    </label>
  );
}

export function Instruction({ children }) {
  return <p className="ui-instruction">{children}</p>;
}

export function SectionTitle({ children }) {
  return <h3 className="ui-section-title">{children}</h3>;
}

export function PageTitle({ children }) {
  return <h1 className="ui-page-title">{children}</h1>;
}

export function TextInput({ className: _className, style: _style, ...props }) {
  return <input {...props} className="ui-input" />;
}

export function Select({
  children,
  inline = false,
  className: _className,
  style: _style,
  ...props
}) {
  return (
    <select
      {...props}
      className={joinClasses("ui-input", inline && "ui-input--inline")}
    >
      {children}
    </select>
  );
}

export function Textarea({
  size = "default",
  indentOnTab = false,
  className: _className,
  style: _style,
  onChange,
  onKeyDown,
  ...props
}) {
  return (
    <textarea
      {...props}
      className={joinClasses("ui-input", "ui-textarea", `ui-textarea--${size}`)}
      onChange={onChange}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!indentOnTab || event.defaultPrevented || event.key !== "Tab")
          return;
        event.preventDefault();
        const target = event.currentTarget;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const nextValue = `${target.value.slice(0, start)}  ${target.value.slice(end)}`;
        onChange?.({
          target: { ...target, value: nextValue },
          currentTarget: { ...target, value: nextValue },
        });
        requestAnimationFrame(() =>
          target.setSelectionRange(start + 2, start + 2),
        );
      }}
    />
  );
}

export function Checkbox({
  label,
  className: _className,
  style: _style,
  ...props
}) {
  return (
    <label className="ui-choice">
      <input {...props} type="checkbox" className="ui-choice__control" />
      <span>{label}</span>
    </label>
  );
}

export function RadioGroup({ label, name, options, value, onChange }) {
  return (
    <fieldset className="ui-radio-group">
      <legend>{label}</legend>
      {options.map((option) => (
        <label className="ui-choice" key={option.value}>
          <input
            type="radio"
            className="ui-choice__control"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled}
            onChange={() => onChange?.(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function Panel({
  variant = "standard",
  density = "default",
  fill = false,
  title,
  eyebrow,
  description,
  meta,
  actions,
  children,
  className,
}) {
  return (
    <section
      className={joinClasses(
        "ui-panel",
        `ui-panel--${variant}`,
        `ui-panel--${density}`,
        fill && "ui-panel--fill",
        className,
      )}
    >
      {title || eyebrow || actions ? (
        <header className="ui-panel__header">
          <div>
            {eyebrow ? <p className="ui-eyebrow">{eyebrow}</p> : null}
            {title ? (
              <div className="ui-panel__heading">
                <h2 className="ui-panel__title">{title}</h2>
                {meta ? <div className="ui-panel__meta">{meta}</div> : null}
                {description ? (
                  <p className="ui-panel__description">{description}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          {actions ? <div className="ui-panel__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="ui-panel__body">{children}</div>
    </section>
  );
}

export function ListRow({
  title,
  detail,
  selected = false,
  action,
  children,
  ...props
}) {
  return (
    <div
      {...props}
      className={joinClasses("ui-list-row", selected && "is-selected")}
    >
      <div className="ui-list-row__copy">
        <strong>{title}</strong>
        {detail ? <span>{detail}</span> : null}
      </div>
      {children}
      {action ? <div className="ui-list-row__action">{action}</div> : null}
    </div>
  );
}

export function SelectableRow({
  title,
  detail,
  selected,
  onSelectedChange,
  selectionMode = "multiple",
  action,
}) {
  const id = useId();
  const controlType = selectionMode === "single" ? "radio" : "checkbox";
  return (
    <div
      className={joinClasses("ui-selectable-row", selected && "is-selected")}
    >
      <label htmlFor={id} className="ui-selectable-row__label">
        <input
          id={id}
          type={controlType}
          className="ui-selectable-row__control"
          checked={selected}
          onChange={(event) => onSelectedChange?.(event.target.checked)}
        />
        <span className="ui-selectable-row__copy">
          <strong>{title}</strong>
          {detail ? <span>{detail}</span> : null}
        </span>
      </label>
      {action ? (
        <div className="ui-selectable-row__action">{action}</div>
      ) : null}
    </div>
  );
}

export function StatusBadge({ tone = "neutral", size = "default", children }) {
  return (
    <span
      className={joinClasses(
        "ui-status-badge",
        `ui-status-badge--${tone}`,
        `ui-status-badge--${size}`,
      )}
    >
      {children}
    </span>
  );
}

export function StepStrip({ steps, activeId }) {
  const activeIndex = steps.findIndex((step) => step.id === activeId);
  return (
    <ol className="ui-step-strip">
      {steps.map((step, index) => (
        <li
          key={step.id}
          className={joinClasses(
            index < activeIndex && "is-complete",
            index === activeIndex && "is-active",
          )}
        >
          <span>{index + 1}</span>
          <div>
            <strong>{step.label}</strong>
            {step.description ? <small>{step.description}</small> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function CollapsibleSection({
  title,
  summary,
  count,
  defaultOpen = false,
  children,
}) {
  return (
    <details className="ui-collapsible-section" open={defaultOpen}>
      <summary>
        <span>
          <strong>{title}</strong>
          {summary ? <small>{summary}</small> : null}
        </span>
        {count != null ? (
          <StatusBadge>{count}</StatusBadge>
        ) : (
          <Icon name="chevron" />
        )}
      </summary>
      <div className="ui-collapsible-section__body">{children}</div>
    </details>
  );
}

export function Tabs({ items, activeId, onChange }) {
  return (
    <div className="ui-tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={joinClasses(
            "ui-tabs__tab",
            activeId === item.id && "is-active",
          )}
          role="tab"
          aria-selected={activeId === item.id}
          onClick={() => onChange?.(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function SegmentedControl({ items, value, onChange }) {
  return (
    <div className="ui-segmented-control">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={joinClasses(
            "ui-segmented-control__item",
            value === item.id && "is-active",
          )}
          aria-pressed={value === item.id}
          onClick={() => onChange?.(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="ui-empty-state">
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading" }) {
  return (
    <div className="ui-loading-state" role="status">
      <span className="ui-loading-state__indicator" />
      {label}
    </div>
  );
}

export function LoadingPlaceholder({ variant = "block", label = "Loading" }) {
  return (
    <div
      className={joinClasses(
        "ui-loading-placeholder",
        `ui-loading-placeholder--${variant}`,
      )}
      role="status"
      aria-label={label}
    >
      <span />
      <span />
      <span />
    </div>
  );
}

export function Notification({ tone = "info", children }) {
  return (
    <div
      className={joinClasses("ui-notification", `ui-notification--${tone}`)}
      role={tone === "danger" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

export function DescriptionList({ items }) {
  return (
    <dl className="ui-description-list">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CodeBlock({ label, children }) {
  return (
    <section className="ui-code-block">
      {label ? <p>{label}</p> : null}
      <pre>{children}</pre>
    </section>
  );
}

export function Stack({ gap = "default", fill = false, children }) {
  return (
    <div
      className={joinClasses(
        "ui-stack",
        `ui-stack--${gap}`,
        fill && "ui-stack--fill",
      )}
    >
      {children}
    </div>
  );
}

export function Inline({
  gap = "default",
  align = "center",
  justify = "start",
  children,
}) {
  return (
    <div
      className={joinClasses(
        "ui-inline",
        `ui-inline--${gap}`,
        `ui-inline--align-${align}`,
        `ui-inline--justify-${justify}`,
      )}
    >
      {children}
    </div>
  );
}

export function Grid({ columns = 2, children }) {
  return (
    <div className={joinClasses("ui-grid", `ui-grid--${columns}`)}>
      {children}
    </div>
  );
}

export function SplitPane({ primary, secondary, direction = "horizontal" }) {
  return (
    <div
      className={joinClasses("ui-split-pane", `ui-split-pane--${direction}`)}
    >
      <div className="ui-split-pane__primary">{primary}</div>
      <div className="ui-split-pane__secondary">{secondary}</div>
    </div>
  );
}

export function ImageFrame({ variant = "static", src, alt, caption, actions }) {
  if (variant === "zoomable")
    return (
      <ZoomableImageFrame
        src={src}
        alt={alt}
        caption={caption}
        actions={actions}
      />
    );
  return (
    <figure className="ui-image-frame">
      <div className="ui-image-frame__image">
        <img src={src} alt={alt} />
      </div>
      {caption || actions ? (
        <figcaption>
          <span>{caption}</span>
          {actions ? <Inline gap="compact">{actions}</Inline> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

function ZoomableImageFrame({ src, alt, caption, actions }) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  const reset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };
  const zoom = (amount) =>
    setScale((value) =>
      Math.max(1, Math.min(4, Number((value + amount).toFixed(2)))),
    );
  return (
    <figure className="ui-image-frame ui-image-frame--zoomable">
      <div
        className="ui-image-frame__zoom-view"
        onWheel={(event) => {
          event.preventDefault();
          zoom(event.deltaY < 0 ? 0.15 : -0.15);
        }}
        onDoubleClick={reset}
        onPointerDown={(event) => {
          if (scale === 1) return;
          drag.current = {
            x: event.clientX - position.x,
            y: event.clientY - position.y,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          setPosition({
            x: event.clientX - drag.current.x,
            y: event.clientY - drag.current.y,
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <img
          src={src}
          alt={alt}
          draggable="false"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          }}
        />
      </div>
      <figcaption>
        <span>{caption}</span>
        <Inline gap="compact">
          <Button
            size="compact"
            onClick={() => zoom(-0.25)}
            disabled={scale === 1}
            aria-label="Zoom out"
          >
            −
          </Button>
          <StatusBadge>{Math.round(scale * 100)}%</StatusBadge>
          <Button
            size="compact"
            onClick={() => zoom(0.25)}
            aria-label="Zoom in"
          >
            +
          </Button>
          <Button size="compact" onClick={reset}>
            Fit
          </Button>
          {actions}
        </Inline>
      </figcaption>
    </figure>
  );
}

export function Dialog({
  open,
  title,
  description,
  onClose,
  size = "default",
  actions,
  footer,
  children,
}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onCloseRef.current?.();
      if (event.key !== "Tab") return;
      const focusable = [
        ...(dialogRef.current?.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) || []),
      ];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="ui-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        ref={dialogRef}
        className={joinClasses("ui-dialog", `ui-dialog--${size}`)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ui-dialog-title"
        tabIndex="-1"
      >
        <header className="ui-dialog__header">
          <div>
            <h2 id="ui-dialog-title">{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <Inline gap="compact">
            {actions}
            <IconButton label="Close dialog" onClick={onClose}>
              <Icon name="close" />
            </IconButton>
          </Inline>
        </header>
        <div className="ui-dialog__body">{children}</div>
        {footer ? (
          <footer className="ui-dialog__footer">{footer}</footer>
        ) : null}
      </section>
    </div>
  );
}

export function CanvasSurface({
  children,
  label = "Workflow canvas",
  size = "default",
  fill = false,
  onPointerMove,
  onPointerLeave,
}) {
  const [zoom, setZoom] = useState(1);
  return (
    <section
      className={joinClasses(
        "ui-canvas",
        `ui-canvas--${size}`,
        fill && "ui-canvas--fill",
      )}
      aria-label={label}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <div
        className="ui-canvas__viewport"
        style={{ transform: `scale(${zoom})` }}
      >
        {children}
      </div>
      <CanvasToolbar
        zoom={zoom}
        onZoomIn={() => setZoom((value) => Math.min(1.25, value + 0.125))}
        onZoomOut={() => setZoom((value) => Math.max(0.75, value - 0.125))}
      />
    </section>
  );
}

export function CanvasToolbar({ zoom, onZoomIn, onZoomOut }) {
  return (
    <div className="ui-canvas-toolbar">
      <Button size="compact" onClick={onZoomOut} aria-label="Zoom out">
        −
      </Button>
      <StatusBadge>{Math.round(zoom * 100)}%</StatusBadge>
      <Button size="compact" onClick={onZoomIn} aria-label="Zoom in">
        +
      </Button>
    </div>
  );
}

export function CanvasNode({
  x,
  y,
  title,
  detail,
  selected = false,
  variant = "default",
  onClick,
  onContextMenu,
  ariaLabel,
}) {
  return (
    <button
      type="button"
      className={joinClasses(
        "ui-canvas-node",
        `ui-canvas-node--${variant}`,
        selected && "is-selected",
      )}
      style={{ left: `${x}%`, top: `${y}%` }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      aria-label={ariaLabel || title}
    >
      <strong>{title}</strong>
      {detail ? <span>{detail}</span> : null}
    </button>
  );
}

export function CanvasEdge({
  fromX,
  fromY,
  toX,
  toY,
  selected = false,
  onClick,
}) {
  return (
    <svg
      className={joinClasses("ui-canvas-edge", selected && "is-selected")}
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <line x1={fromX} y1={fromY} x2={toX} y2={toY} />
      {onClick ? (
        <line
          className="ui-canvas-edge__hit-target"
          x1={fromX}
          y1={fromY}
          x2={toX}
          y2={toY}
          onClick={onClick}
        />
      ) : null}
    </svg>
  );
}
