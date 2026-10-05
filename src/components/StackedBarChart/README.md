# StackedBarChart

Categories and series retain input order. Values are finite, nonnegative numbers or `null` for an omitted segment; zero remains a real value.

```tsx
<StackedBarChart
  data={quarterlySales}
  getKey={(quarter) => quarter.id}
  getLabel={(quarter) => quarter.label}
  title="Quarterly sales"
  description="Online and store sales by quarter."
  series={[
    { id: 'online', label: 'Online', color: '#B29DF8', value: (q) => q.online },
    { id: 'store', label: 'In store', color: '#A75E6E', value: (q) => q.store },
  ]}
/>
```

Optional `summaries` add totals to tooltips and the accessible table; `showInTooltip` controls conditional display. `minPlotWidth={0}` fits all categories. `getCompactLabel`, `getAccessibleLabel`, `formatValue`, and `ticks` customize presentation. The component owns the legend, keyboard navigation, tooltip positioning, and equivalent text table; the feature chooses the data policy.
