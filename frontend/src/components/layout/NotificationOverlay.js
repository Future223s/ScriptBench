"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const NotificationOverlayContext = createContext(null);
const NOTIFICATION_TTL_MS = 10_000;

function normalizeNotification(notification) {
  if (!notification || !notification.message) return null;
  return {
    kind: notification.kind || "success",
    message: String(notification.message),
  };
}

export function useNotificationOverlay() {
  return useContext(NotificationOverlayContext);
}

export function NotificationOverlayProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const timersRef = useRef(new Map());

  const clearTimer = useCallback((source) => {
    const existingTimer = timersRef.current.get(source);
    if (existingTimer != null) {
      window.clearTimeout(existingTimer);
      timersRef.current.delete(source);
    }
  }, []);

  const syncNotifications = useCallback((source, nextNotifications) => {
    const normalized = Array.isArray(nextNotifications)
      ? nextNotifications.map(normalizeNotification).filter(Boolean)
      : [];

    clearTimer(source);
    setNotifications((current) => {
      const remaining = current.filter((item) => item.source !== source);
      const nextItems = normalized.map((item, index) => ({
        id: `${source}:${index}:${item.kind}:${item.message}`,
        source,
        ...item,
      }));
      return [...remaining, ...nextItems];
    });

    if (normalized.length) {
      const timerId = window.setTimeout(() => {
        clearTimer(source);
        setNotifications((current) => current.filter((item) => item.source !== source));
      }, NOTIFICATION_TTL_MS);
      timersRef.current.set(source, timerId);
    }
  }, [clearTimer]);

  const clearNotifications = useCallback((source) => {
    clearTimer(source);
    setNotifications((current) => current.filter((item) => item.source !== source));
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      timersRef.current.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      syncNotifications,
      clearNotifications,
    }),
    [clearNotifications, notifications, syncNotifications],
  );

  return <NotificationOverlayContext.Provider value={value}>{children}</NotificationOverlayContext.Provider>;
}
