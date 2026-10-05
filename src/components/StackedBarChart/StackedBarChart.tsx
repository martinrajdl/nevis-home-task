import { useId, useRef, useState, type CSSProperties } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
} from 'recharts';
import { createStackedData, getAxisTicks, type ChartSeries, type StackedDatum } from './model';
import { ChartTooltip } from './ChartTooltip';
import styles from './StackedBarChart.module.css';

export type { ChartSeries } from './model';
export interface ChartSummary<T> {
  id: string;
  label: string;
  value: (datum: T) => number;
  showInTooltip?: (datum: T) => boolean;
}
export interface StackedBarChartProps<T> {
  data: readonly T[];
  series: readonly ChartSeries<T>[];
  getKey: (datum: T) => string;
  getLabel: (datum: T) => string;
  getCompactLabel?: (datum: T) => string;
  getAccessibleLabel?: (datum: T) => string;
  title: string;
  description: string;
  tableCaption?: string;
  summaries?: readonly ChartSummary<T>[];
  ticks?: number[];
  formatValue?: (value: number) => string;
  minPlotWidth?: number;
}
function RoundedSegment<T>({
  shape,
  series,
  index,
  points,
}: {
  shape: BarShapeProps;
  series: readonly ChartSeries<T>[];
  index: number;
  points: readonly StackedDatum<T>[];
}) {
  const point = points[shape.index];
  const nonzero = series.flatMap((item, i) => ((point?.values[item.id] ?? 0) > 0 ? [i] : []));
  const top = nonzero.at(-1) === index ? 4 : 0;
  const bottom = nonzero[0] === index ? 4 : 0;
  return (
    <Rectangle
      x={shape.x}
      y={shape.y}
      width={shape.width}
      height={shape.height}
      fill={shape.fill}
      radius={[top, top, bottom, bottom]}
    />
  );
}
export function StackedBarChart<T>({
  data,
  series,
  getKey,
  getLabel,
  getCompactLabel = getLabel,
  getAccessibleLabel = getLabel,
  title,
  description,
  tableCaption = title,
  summaries = [],
  ticks: explicitTicks,
  formatValue = String,
  minPlotWidth = 480,
}: StackedBarChartProps<T>) {
  const id = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const keyboardNavigation = useRef(false);
  const [compact, setCompact] = useState(false);
  const [tooltipViewport, setTooltipViewport] = useState<HTMLDivElement | null>(null);
  const points = createStackedData(data, series, getKey, getLabel);
  const ticks = explicitTicks ?? getAxisTicks(Math.max(0, ...points.map((point) => point.total)));
  const maximum = ticks.at(-1) ?? 1;
  return (
    <figure
      className={styles.card}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      style={{ '--plot-min-width': `${minPlotWidth}px` } as CSSProperties}
    >
      <figcaption id={`${id}-title`} className="sr-only">
        {title}
      </figcaption>
      <p id={`${id}-description`} className="sr-only">
        {description} Use the left and right arrow keys on the chart to inspect categories. The same
        chart values are available in the following accessible table.
      </p>
      <div className={styles.plotViewport}>
        <div
          ref={scrollRef}
          className={styles.scroll}
          role="region"
          aria-label={minPlotWidth > 0 ? 'Chart, horizontally scrollable on small screens' : 'Chart data'}
          onKeyDownCapture={() => {
            keyboardNavigation.current = true;
          }}
          onPointerDownCapture={() => {
            keyboardNavigation.current = false;
          }}
          onPointerMoveCapture={() => {
            keyboardNavigation.current = false;
          }}
        >
          <div className={styles.plot}>
            <ResponsiveContainer
              width="100%"
              height="100%"
              initialDimension={{ width: 1376, height: 358 }}
              onResize={(width) => setCompact(width < 640)}
            >
              <BarChart<StackedDatum<T>>
                data={points}
                margin={{ top: 10, right: 0, bottom: 0, left: 0 }}
                barCategoryGap={compact ? 3 : 12}
                accessibilityLayer
                aria-label={title}
                aria-describedby={`${id}-description`}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--chart-grid)"
                  strokeDasharray="1 6"
                  strokeLinecap="round"
                />
                <XAxis
                  dataKey="key"
                  axisLine={false}
                  tickLine={false}
                  tickSize={0}
                  tickMargin={compact ? 8 : 12}
                  interval={0}
                  height={compact ? 24 : 28}
                  tick={({ x, y, payload }) => {
                    const point = points.find((point) => point.key === payload.value);
                    return (
                      <text x={x} y={y} dy={12} textAnchor="middle" fill="var(--muted)" fontSize={compact ? 10 : 12}>
                        {point ? (compact ? getCompactLabel(point.source) : point.label) : payload.value}
                      </text>
                    );
                  }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickSize={0}
                  width={compact ? 28 : 38}
                  tickMargin={compact ? 8 : 12}
                  allowDecimals={false}
                  ticks={ticks}
                  domain={[0, maximum]}
                  tick={({ x, y, payload }) => (
                    <text
                      x={x}
                      y={y}
                      dy={3 - Number(payload.value) / maximum}
                      textAnchor="end"
                      fill="var(--muted)"
                      fontSize={compact ? 10 : 12}
                    >
                      {formatValue(Number(payload.value))}
                    </text>
                  )}
                />
                <Tooltip
                  portal={tooltipViewport}
                  wrapperStyle={{ pointerEvents: 'none' }}
                  cursor={{ fill: '#14141306' }}
                  isAnimationActive={false}
                  content={({ active, label, coordinate }) => {
                    const point = active ? points.find((datum) => datum.key === label) : undefined;
                    if (!point) return null;
                    return (
                      <ChartTooltip
                        label={getAccessibleLabel(point.source)}
                        x={coordinate?.x ?? 0}
                        y={coordinate?.y ?? 0}
                        viewport={tooltipViewport}
                        scrollRef={scrollRef}
                        keyboardNavigation={keyboardNavigation}
                      >
                        <p className={styles.tooltipLabel}>{getAccessibleLabel(point.source)}</p>
                        <dl>
                          {series.filter((item) => point.values[item.id] != null).map((item) => (
                            <div key={item.id}>
                              <dt>
                                <span
                                  className={styles.swatch}
                                  style={{ backgroundColor: item.color }}
                                />
                                {item.label}
                              </dt>
                              <dd>{formatValue(point.values[item.id] ?? 0)}</dd>
                            </div>
                          ))}
                          {summaries
                            .filter((item) => item.showInTooltip?.(point.source) ?? true)
                            .map((item, index) => (
                              <div key={item.id} className={index === 0 ? styles.total : undefined}>
                                <dt>{item.label}</dt>
                                <dd>{formatValue(item.value(point.source))}</dd>
                              </div>
                            ))}
                        </dl>
                      </ChartTooltip>
                    );
                  }}
                />
                {series.map((item, index) => (
                  <Bar
                    key={item.id}
                    name={item.label}
                    dataKey={(point: StackedDatum<T>) => point.values[item.id] ?? 0}
                    stackId="values"
                    fill={item.color}
                    isAnimationActive={false}
                    shape={(shape: BarShapeProps) => (
                      <RoundedSegment shape={shape} series={series} index={index} points={points} />
                    )}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <p className={styles.keyboardHint} aria-hidden="true">← → Explore chart</p>
        <div ref={setTooltipViewport} className={styles.tooltipViewport} />
      </div>
      <ul className={styles.legend} aria-label="Chart legend">
        {series.map((item) => (
          <li key={item.id}>
            <span
              className={styles.swatch}
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            {item.label}
          </li>
        ))}
      </ul>
      <div className="sr-only">
        <table>
          <caption>{tableCaption}</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              {series.map((item) => (
                <th scope="col" key={item.id}>
                  {item.label}
                </th>
              ))}
              {summaries.map((item) => (
                <th scope="col" key={item.id}>
                  {item.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.key}>
                <th scope="row">{getAccessibleLabel(point.source)}</th>
                {series.map((item) => (
                  <td key={item.id}>{point.values[item.id] == null
                    ? 'Not plotted' : formatValue(point.values[item.id]!)}</td>
                ))}
                {summaries.map((item) => (
                  <td key={item.id}>{formatValue(item.value(point.source))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
