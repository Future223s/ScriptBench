export function selectedJobIds(selection, key) {
  return Array.isArray(selection?.[key]) ? selection[key] : [];
}
