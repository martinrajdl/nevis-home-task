# TreeTable

Supply row identity, labels, children, and column renderers. Expansion is controlled; actions beside a label remain independent.

The data-driven API keeps recursive traversal and accessible relationships inside the table. Render callbacks compose cell content, labels, actions, and empty states. Compound `<TreeTable.Row>` children would give callers more markup control, but add coordination for this hierarchy.

```tsx
<TreeTable
  rows={folders}
  getRowId={(folder) => folder.key}
  getRowLabel={(folder) => folder.title}
  getChildren={(folder) => folder.entries ?? []}
  columns={[{ id: 'size', header: 'Size', cell: (folder) => `${folder.bytes} B` }]}
  expandedIds={expandedIds}
  onToggle={toggleFolder}
  caption="Files and folders"
  rowHeaderLabel="Filename"
  scrollLabel="File list"
/>
```

`canExpandRow` and `renderEmptyState` support empty containers. `renderRowLabel` supplies presentational content; `renderRowActions` supplies independent buttons. `selectedRowId` highlights a row. IDs must be unique and the tree acyclic. The component owns header associations, ancestry descriptions, keyboard disclosure, and contained scrolling.

Set `--tree-table-min-width` and `--tree-table-label-width` on a parent CSS class to control layout. Defaults are 640px and 288px. The consuming feature can change these properties in its own media queries; there are no viewport-specific React props. The client dashboard's dimensions live in [ClientTable.module.css](../../features/clients/components/ClientTable.module.css).
