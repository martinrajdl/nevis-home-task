export interface ChartSeries<T> {
  id: string;
  label: string;
  color: string;
  value: (datum: T) => number | null;
}
export interface StackedDatum<T> {
  source: T;
  key: string;
  label: string;
  values: Record<string, number | null>;
  total: number;
}
export function createStackedData<T>(
  data: readonly T[],
  series: readonly ChartSeries<T>[],
  getKey: (datum: T) => string,
  getLabel: (datum: T) => string,
): StackedDatum<T>[] {
  return data.map((source) => {
    const values = Object.fromEntries(series.map((item) => [item.id, item.value(source)]));
    return {
      source,
      key: getKey(source),
      label: getLabel(source),
      values,
      total: Object.values(values).reduce<number>((sum, value) => sum + (value ?? 0), 0),
    };
  });
}
export function getAxisTicks(maximum: number): number[] {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, maximum) / 4));
  const normalized = Math.max(1, maximum) / 4 / magnitude;
  const step = Math.max(
    1,
    magnitude * (normalized >= 7.5 ? 10 : normalized >= 3.5 ? 5 : normalized >= 1.5 ? 2 : 1),
  );
  const ceiling = Math.max(step, Math.ceil(maximum / step) * step);
  return Array.from({ length: ceiling / step + 1 }, (_, index) => index * step);
}
