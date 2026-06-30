"use client";

import { useEffect, useRef } from "react";

export default function DashboardRoute() {
  const rootRef = useRef(null);

  useEffect(() => {
    let dispose = () => {};
    let isMounted = true;

    import("../src/dashboard/DashboardPage.js").then(({ initDashboardPage }) => {
      if (isMounted && rootRef.current) {
        dispose = initDashboardPage(rootRef.current) || dispose;
      }
    });

    return () => {
      isMounted = false;
      dispose();
    };
  }, []);

  return <div ref={rootRef} />;
}
