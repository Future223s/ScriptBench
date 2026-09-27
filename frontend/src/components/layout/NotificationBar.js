"use client";

import { Notification } from "../../ui/primitives/index.js";

const bannerClassByKind = {
  error: "danger",
  status: "info",
  success: "success",
};

export function NotificationBar({ kind, message, role = "status" }) {
  if (!message) return null;

  const tone = bannerClassByKind[kind] || bannerClassByKind.success;
  return <Notification tone={tone}>{message}</Notification>;
}
