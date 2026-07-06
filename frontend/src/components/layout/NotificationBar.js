"use client";

const bannerClassByKind = {
  error: "error-banner",
  status: "status-banner",
  success: "success-banner",
};

export function NotificationBar({ kind, message, role = "status" }) {
  if (!message) return null;

  const className = bannerClassByKind[kind] || bannerClassByKind.success;
  return (
    <div className={className} role={role}>
      {message}
    </div>
  );
}
