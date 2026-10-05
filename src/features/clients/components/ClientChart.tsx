import { useLayoutEffect, useRef } from 'react';
import {
  StackedBarChart,
  type ChartSummary,
} from '../../../components/StackedBarChart/StackedBarChart';
import { type ChartModel, type ChartMonth, type ClientNode } from '../model';
import styles from './ClientChart.module.css';

// First three colors follow Figma's stack order; the remaining colors cover additional series.
const COLORS = ['#B29DF8', '#F4BEB4', '#A75E6E', '#94a9b3', '#cbbb91'] as const;
const breakdownNames = {
  company: 'branch',
  branch: 'advisor',
  employee: 'acquisition channel',
  channel: 'channel',
} as const;

interface ClientChartProps {
  model: ChartModel;
  path: readonly ClientNode[];
  onSelectScope: (id: string) => void;
}

export function ClientChart({ model, path, onSelectScope }: ClientChartProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousScopeId = useRef(model.scope.id);
  useLayoutEffect(() => {
    if (previousScopeId.current !== model.scope.id) {
      previousScopeId.current = model.scope.id;
      headingRef.current?.focus();
    }
  }, [model.scope.id]);
  const breakdownName = breakdownNames[model.scope.kind];
  const summaries: ChartSummary<ChartMonth>[] = [
    {
      id: 'plotted',
      label: model.isBreakdown ? 'Breakdown total' : 'Reported total',
      value: (month) => month.plottedTotal,
    },
    ...(model.isBreakdown ? [{
      id: 'reported',
      label: 'Reported total',
      value: (month: ChartMonth) => month.reportedTotal,
      showInTooltip: (month: ChartMonth) => month.breakdownTotal !== month.reportedTotal,
    }] : []),
  ];
  const description = [
    'February 2024 through January 2025.',
    model.isBreakdown
      ? `Bars stack the supplied ${breakdownName} figures. The reported total is shown separately when it differs from the breakdown.`
      : 'Bars show reported totals. No further breakdown is available.',
  ].join(' ');

  return (
    <section id="client-chart" className={styles.card} aria-labelledby="client-chart-title">
      <header className={path.length > 1 ? styles.caption : 'sr-only'}>
        {path.length > 1 ? <nav aria-label="Chart scope">
          <ol className={styles.breadcrumb}>
            {path.map((node, index) => (
              <li key={node.id}>
                {index > 0 ? <span aria-hidden="true">/</span> : null}
                {node.id === model.scope.id ? (
                  <span aria-current="location">{node.name}</span>
                ) : (
                  <button type="button" onClick={() => onSelectScope(node.id)}>{node.name}</button>
                )}
              </li>
            ))}
          </ol>
        </nav> : null}
        <h2 ref={headingRef} id="client-chart-title" tabIndex={-1}>
          {model.scope.name} clients{model.isBreakdown ? ` by ${breakdownName}` : ''}
        </h2>
        {!model.isBreakdown ? <p>No further breakdown is available.</p> : null}
      </header>
      <StackedBarChart
        key={model.scope.id}
        data={model.months}
        minPlotWidth={0}
        series={model.series.map((series, index) => ({
          id: series.id,
          label: series.name,
          color: COLORS[index % COLORS.length] ?? COLORS[0],
          value: (month: ChartMonth) => month.segments[series.id] ?? null,
        }))}
        getKey={(month) => month.month.key}
        getLabel={(month) => month.month.label}
        getCompactLabel={(month) => month.month.label.slice(0, 3)}
        getAccessibleLabel={(month) => month.month.full}
        title={`Monthly clients for ${model.scope.name}`}
        description={description}
        tableCaption={`Chart values for ${model.scope.name}`}
        summaries={summaries}
      />

    </section>
  );
}
