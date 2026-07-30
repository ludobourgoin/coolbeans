// Module-scoped counter for GridBackdrop pattern IDs.
// Persists across all component instances on a page.
let counter = 0;

export function getGridId() {
  return `grid-${++counter}`;
}
