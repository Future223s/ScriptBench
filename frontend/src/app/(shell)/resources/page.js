"use client";

import { ResourceCatalogPageView } from "../../../components/resources/ResourceCatalogPageView.js";
import { useResourceCatalogPage } from "../../../hooks/resources/useResourceCatalogPage.js";

export default function ResourceCatalogRoute() {
  const resourceCatalog = useResourceCatalogPage();

  return (
    <ResourceCatalogPageView
      state={resourceCatalog.state}
      actions={resourceCatalog.actions}
    />
  );
}
