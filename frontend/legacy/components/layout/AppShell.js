"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigationItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Sample sets and analytics",
  },
  {
    href: "/file-management",
    label: "File Management",
    description: "Uploads and grouping",
  },
  {
    href: "/workspace",
    label: "Workspace",
    description: "Jobs and review",
  },
];

export function AppShell({ children }) {
  const pathname = usePathname() || "";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-header">
          <div className="brand">
            <span className="brand-title">ScriptBench</span>
            <span className="brand-subtitle">Workflow and transcription dashboard</span>
          </div>
        </div>
        <nav className="prototype-nav" aria-label="Primary navigation">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`prototype-nav-item ${isActive ? "is-active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="prototype-nav-title">{item.label}</span>
                <span className="prototype-nav-description">{item.description}</span>
              </Link>
            );
          })}
        </nav>
      </header>
      {children}
    </div>
  );
}
