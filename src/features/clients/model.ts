// The payload has no period metadata; the brief defines these twelve monthly slots.
export const MONTHS = [
  { key: '2024-02', label: 'Feb 2024', full: 'February 2024' },
  { key: '2024-03', label: 'Mar 2024', full: 'March 2024' },
  { key: '2024-04', label: 'Apr 2024', full: 'April 2024' },
  { key: '2024-05', label: 'May 2024', full: 'May 2024' },
  { key: '2024-06', label: 'Jun 2024', full: 'June 2024' },
  { key: '2024-07', label: 'Jul 2024', full: 'July 2024' },
  { key: '2024-08', label: 'Aug 2024', full: 'August 2024' },
  { key: '2024-09', label: 'Sep 2024', full: 'September 2024' },
  { key: '2024-10', label: 'Oct 2024', full: 'October 2024' },
  { key: '2024-11', label: 'Nov 2024', full: 'November 2024' },
  { key: '2024-12', label: 'Dec 2024', full: 'December 2024' },
  { key: '2025-01', label: 'Jan 2025', full: 'January 2025' },
] as const;

export type Month = (typeof MONTHS)[number];
export type MonthlyValues = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];
export type NodeKind = 'company' | 'branch' | 'employee' | 'channel';

export interface ClientNode {
  readonly id: string;
  readonly name: string;
  readonly values: MonthlyValues;
  readonly kind: NodeKind;
  readonly children: readonly ClientNode[];
}

export class InvalidClientDataError extends Error {
  constructor() {
    super('The server returned client data in an unexpected format.');
    this.name = 'InvalidClientDataError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMonthlyValues(value: unknown): value is MonthlyValues {
  return (
    Array.isArray(value) &&
    value.length === MONTHS.length &&
    value.every(
      (item: unknown) => typeof item === 'number' && Number.isSafeInteger(item) && item >= 0,
    )
  );
}

const kinds: readonly NodeKind[] = ['company', 'branch', 'employee', 'channel'];
const childKeys = ['branches', 'employees', 'channels'] as const;

/** Validate once at the network boundary, then give components a uniform tree. */
export function parseClientBook(payload: unknown): ClientNode {
  const seenIds = new Set<string>();

  function visit(value: unknown, depth: number): ClientNode {
    const kind = kinds[depth];
    if (
      !kind ||
      !isRecord(value) ||
      typeof value.id !== 'string' ||
      !value.id.trim() ||
      typeof value.name !== 'string' ||
      !value.name.trim() ||
      !isMonthlyValues(value.values) ||
      seenIds.has(value.id)
    ) {
      throw new InvalidClientDataError();
    }
    seenIds.add(value.id);
    const childKey = childKeys[depth];
    // Unexpected nesting is a contract error, not an empty branch.
    if (childKeys.some((key) => key !== childKey && key in value))
      throw new InvalidClientDataError();
    const children: unknown = childKey && childKey in value ? value[childKey] : [];
    if (!Array.isArray(children)) throw new InvalidClientDataError();

    return {
      id: value.id,
      name: value.name,
      values: value.values,
      kind,
      children: children.map((child: unknown) => visit(child, depth + 1)),
    };
  }

  return visit(payload, 0);
}

export interface ChartMonth {
  month: Month;
  segments: Readonly<Record<string, number>>;
  reportedTotal: number;
  breakdownTotal: number | null;
  plottedTotal: number;
}

export function findNodePath(root: ClientNode, id: string): readonly ClientNode[] | undefined {
  if (root.id === id) return [root];
  for (const child of root.children) {
    const path = findNodePath(child, id);
    if (path) return [root, ...path];
  }
  return undefined;
}

export interface ChartModel {
  scope: ClientNode;
  series: readonly { id: string; name: string }[];
  months: readonly ChartMonth[];
  discrepancies: readonly ChartMonth[];
  isBreakdown: boolean;
}

export function buildChartModel(scope: ClientNode): ChartModel {
  const isBreakdown = scope.children.length > 0;
  const nodes = isBreakdown ? scope.children : [scope];
  const series = nodes.map((node) => ({ id: `node:${node.id}`, name: node.name }));
  const months = MONTHS.map((month, index): ChartMonth => {
    const reportedTotal = scope.values[index];
    if (reportedTotal === undefined) throw new InvalidClientDataError();
    const segments = Object.fromEntries(nodes.map((node) => {
      const value = node.values[index];
      if (value === undefined) throw new InvalidClientDataError();
      return [`node:${node.id}`, value];
    }));
    const plottedTotal = Object.values(segments).reduce((sum, value) => sum + value, 0);
    return {
      month,
      segments,
      reportedTotal,
      breakdownTotal: isBreakdown ? plottedTotal : null,
      plottedTotal,
    };
  });
  return {
    scope,
    series,
    months,
    isBreakdown,
    discrepancies: months.filter((month) => month.breakdownTotal !== null
      && month.reportedTotal !== month.breakdownTotal),
  };
}
