"use client";

import { usePathname, useRouter } from "next/navigation";

function getPrototypeNav(pathname) {
  if (pathname === "/file-management") return "file-management";
  if (pathname === "/resources") return "resources";
  if (pathname === "/workspace") return "workflow-workspace";
  if (pathname === "/workflow-builder") return "workflow-builder";
  if (pathname === "/analysis") return "analysis";
  return "dashboard";
}

export function useTopBar() {
  const pathname = usePathname() || "";
  const router = useRouter();

  function navigatePrototype(navKey) {
    if (navKey === "file-management") {
      router.push("/file-management");
      return;
    }

    if (navKey === "resources") {
      router.push("/resources");
      return;
    }

    if (navKey === "workflow-workspace") {
      router.push("/workspace");
      return;
    }

    if (navKey === "workflow-builder") {
      router.push("/workflow-builder");
      return;
    }

    if (navKey === "analysis") {
      router.push("/analysis");
      return;
    }

    router.push("/dashboard");
  }

  return {
    prototypeNav: getPrototypeNav(pathname),
    navigatePrototype,
  };
}
