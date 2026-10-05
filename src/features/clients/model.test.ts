import { describe, expect, it } from 'vitest';
import fixture from '../../../server/data/clients.json';
import { MONTHS, buildChartModel, findNodePath, parseClientBook } from './model';

const root = parseClientBook(fixture);
const branch = root.children[0]!;
const anna = branch.children[0]!;

describe('client data boundary', () => {
  it('normalizes the non-uniform tree without modifying reported values', () => {
    expect(root.values).toEqual([250, 267, 284, 301, 317, 334, 350, 250, 250, 250, 250, 350]);
    expect(root.children[1]).toMatchObject({ name: 'Branch 2', children: [], kind: 'branch' });
    expect(branch.children[1]).toMatchObject({
      name: 'James Walker',
      children: [],
      kind: 'employee',
    });
    expect(anna.children).toHaveLength(3);
    expect(anna.children[0]?.kind).toBe('channel');
  });

  it.each([
    ['short monthly array', { ...fixture, values: [1, 2] }],
    ['negative figure', { ...fixture, values: [-1, ...fixture.values.slice(1)] }],
    ['non-numeric figure', { ...fixture, values: ['250', ...fixture.values.slice(1)] }],
    ['duplicate id', { ...fixture, branches: [{ ...fixture.branches[0], id: fixture.id }] }],
    ['invalid child collection', { ...fixture, branches: null }],
    ['incorrect hierarchy', { ...fixture, employees: [] }],
  ])('rejects %s instead of displaying misleading data', (_description, payload) => {
    expect(() => parseClientBook(payload)).toThrow('unexpected format');
  });
});

describe('chart mapping', () => {
  it('stacks the supplied branch figures and keeps the conflicting company total separate', () => {
    const chart = buildChartModel(root);
    expect(chart.series.map((series) => series.name)).toEqual(['Branch 1', 'Branch 2', 'Branch 3']);
    expect(chart.months.map((month) => month.month.key)).toEqual(MONTHS.map((month) => month.key));
    expect(chart.months.map((month) => month.plottedTotal)).toEqual([
      250, 267, 284, 279, 317, 334, 350, 250, 250, 250, 250, 350,
    ]);
    expect(chart.months[3]).toEqual({
      month: MONTHS[3],
      reportedTotal: 301,
      breakdownTotal: 279,
      plottedTotal: 279,
      segments: {
        [`node:${root.children[0]!.id}`]: 156,
        [`node:${root.children[1]!.id}`]: 87,
        [`node:${root.children[2]!.id}`]: 36,
      },
    });
    expect(chart.discrepancies.map(({ month }) => month.label)).toEqual(['May 2024']);
  });

  it('preserves all advisor figures when their sum exceeds the branch total', () => {
    const chart = buildChartModel(branch);
    expect(chart.series.map((series) => series.name)).toEqual([
      'Anna Blackwood', 'James Walker', 'Maria Gutierrez', 'Robert Chen', 'Sarah Smith',
    ]);
    expect(chart.months[6]).toMatchObject({
      plottedTotal: 216, reportedTotal: 214, breakdownTotal: 216,
    });
    for (const child of branch.children) {
      chart.months.forEach((month, index) => {
        expect(month.segments[`node:${child.id}`]).toBe(child.values[index]);
      });
    }
  });

  it('keeps Anna’s actual channels and zeroes without adding synthetic categories', () => {
    const chart = buildChartModel(anna);
    expect(chart.series.map((series) => series.name)).toEqual([
      'Existing clients', 'New organic', 'New paid',
    ]);
    expect(chart.months.map((month) => month.plottedTotal)).toEqual([
      25, 26, 28, 30, 33, 35, 36, 28, 27, 27, 27, 38,
    ]);
    expect(chart.months[0]?.segments[`node:${anna.children[1]!.id}`]).toBe(0);
    expect(chart.months[3]).toMatchObject({ breakdownTotal: 30, reportedTotal: 31 });
    expect(chart.months[4]).toMatchObject({ breakdownTotal: 33, reportedTotal: 32 });
    expect(chart.discrepancies).toHaveLength(5);
  });

  it.each([root.children[1]!, root.children[2]!, branch.children[1]!, anna.children[1]!])(
    'shows $name reported values without inventing a missing breakdown',
    (leaf) => {
      const chart = buildChartModel(leaf);
      expect(chart.isBreakdown).toBe(false);
      expect(chart.series).toEqual([{ id: `node:${leaf.id}`, name: leaf.name }]);
      expect(chart.months.map((month) => month.plottedTotal)).toEqual(leaf.values);
      expect(chart.months.every((month) => month.breakdownTotal === null)).toBe(true);
      expect(chart.discrepancies).toEqual([]);
    },
  );

  it('maps each segment to its source value at every scope without changing the payload', () => {
    const before = JSON.stringify(root);
    function check(node: typeof root) {
      const chart = buildChartModel(node);
      const sourceNodes = node.children.length ? node.children : [node];
      chart.months.forEach((month, index) => {
        const values = sourceNodes.map((source) => source.values[index]!);
        expect(Object.values(month.segments)).toEqual(values);
        expect(month.plottedTotal).toBe(values.reduce((sum, value) => sum + value, 0));
        expect(month.reportedTotal).toBe(node.values[index]);
      });
      node.children.forEach(check);
    }
    check(root);
    expect(JSON.stringify(root)).toBe(before);
  });

  it('preserves a nonzero breakdown alongside a zero reported total', () => {
    const chart = buildChartModel({ ...anna, values: [0, 26, 28, 31, 32, 34, 38, 27, 27, 27, 27, 38] });
    expect(chart.months[0]).toMatchObject({
      plottedTotal: 25, breakdownTotal: 25, reportedTotal: 0,
    });
  });
});

describe('scope navigation', () => {
  it('finds the full path to a channel, including ancestors and the selected node', () => {
    const channel = anna.children[2]!;
    expect(findNodePath(root, channel.id)).toEqual([root, branch, anna, channel]);
    expect(findNodePath(root, root.id)).toEqual([root]);
    expect(findNodePath(root, 'missing')).toBeUndefined();
  });
});
