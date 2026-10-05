import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { StackedBarChart } from './StackedBarChart';
import { createStackedData, getAxisTicks, type ChartSeries } from './model';

type Sales = { quarter: string; web: number; store: number };
const data: Sales[] = [
  { quarter: 'Q1', web: 0, store: 12 },
  { quarter: 'Q2', web: 8, store: 2 },
];
const series: ChartSeries<Sales>[] = [
  { id: 'web', label: 'Online', color: '#B29DF8', value: (row) => row.web },
  { id: 'store', label: 'In store', color: '#A75E6E', value: (row) => row.store },
];
it('maps a different domain into stack values without dropping zero values or changing order', () => {
  const points = createStackedData(
    data,
    series,
    (row) => row.quarter,
    (row) => row.quarter,
  );
  expect(points.map(({ key, values, total }) => ({ key, values, total }))).toEqual([
    { key: 'Q1', values: { web: 0, store: 12 }, total: 12 },
    { key: 'Q2', values: { web: 8, store: 2 }, total: 10 },
  ]);
  expect(getAxisTicks(350)).toEqual([0, 100, 200, 300, 400]);
  expect(getAxisTicks(0)).toEqual([0, 1]);
});
it('shares the exact plotted values with its accessible table and supports custom formatting', () => {
  render(
    <StackedBarChart
      data={data}
      series={series}
      getKey={(row) => row.quarter}
      getLabel={(row) => row.quarter}
      title="Sales"
      description="Quarterly sales"
      formatValue={(value) => `€${value}`}
      summaries={[{ id: 'total', label: 'Total', value: (row) => row.web + row.store }]}
    />,
  );
  const table = screen.getByRole('table', { name: 'Sales' });
  expect(
    within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      ),
  ).toEqual([
    ['€0', '€12', '€12'],
    ['€8', '€2', '€10'],
  ]);
  expect(screen.getByRole('list', { name: 'Chart legend' })).toHaveTextContent('OnlineIn store');
});

it('distinguishes an omitted segment from a real zero in the accessible data', () => {
  const optionalSeries: ChartSeries<Sales>[] = [{
    id: 'web', label: 'Online', color: '#B29DF8', value: (row) => row.quarter === 'Q1' ? null : 0,
  }];
  const points = createStackedData(data, optionalSeries, (row) => row.quarter, (row) => row.quarter);
  expect(points.map((point) => point.values.web)).toEqual([null, 0]);
  expect(points.map((point) => point.total)).toEqual([0, 0]);
  render(<StackedBarChart
    data={data}
    series={optionalSeries}
    getKey={(row) => row.quarter}
    getLabel={(row) => row.quarter}
    title="Optional sales"
    description="Some values are omitted"
  />);
  expect(within(screen.getByRole('table')).getAllByRole('cell').map((cell) => cell.textContent))
    .toEqual(['Not plotted', '0']);
});
