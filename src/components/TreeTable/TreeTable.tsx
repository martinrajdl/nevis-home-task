import { Fragment, useId, type CSSProperties, type ReactNode } from 'react';
import styles from './TreeTable.module.css';

export interface TreeTableColumn<T> {
  id: string;
  header: ReactNode;
  headerLabel?: string;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
}

export interface TreeRowContext<T> {
  depth: number;
  ancestors: readonly T[];
  expandable: boolean;
  expanded: boolean;
  children: readonly T[];
}

export interface TreeTableProps<T> {
  rows: readonly T[];
  columns: readonly TreeTableColumn<T>[];
  getRowId: (row: T) => string;
  getRowLabel: (row: T) => string;
  getChildren: (row: T) => readonly T[];
  canExpandRow?: (row: T) => boolean;
  expandedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  caption: string;
  rowHeaderLabel: string;
  scrollLabel: string;
  renderRowLabel?: (row: T) => ReactNode;
  renderRowActions?: (row: T) => ReactNode;
  selectedRowId?: string;
  renderEmptyState?: (row: T) => ReactNode;
  getRowDescription?: (row: T, context: TreeRowContext<T>) => string;
}

export function TreeChevron({ expanded = false }: { expanded?: boolean }) {
  return (
    <svg
      className={styles.chevron}
      data-expanded={expanded || undefined}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m6.5 4.5 3.5 3.5-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TreeTable<T>({
  rows,
  columns,
  getRowId,
  getRowLabel,
  getChildren,
  canExpandRow,
  expandedIds,
  onToggle,
  caption,
  rowHeaderLabel,
  scrollLabel,
  renderRowLabel = getRowLabel,
  renderRowActions,
  selectedRowId,
  renderEmptyState,
  getRowDescription,
}: TreeTableProps<T>) {
  const tableId = useId();
  const instructionsId = `${tableId}-instructions`;
  const visibleRows: { row: T; context: TreeRowContext<T> }[] = [];
  function visit(items: readonly T[], ancestors: readonly T[]) {
    for (const row of items) {
      const children = getChildren(row);
      const expandable = canExpandRow?.(row) ?? children.length > 0;
      const expanded = expandable && expandedIds.has(getRowId(row));
      const context = { depth: ancestors.length, ancestors, expandable, expanded, children };
      visibleRows.push({ row, context });
      if (expanded) visit(children, [...ancestors, row]);
    }
  }
  visit(rows, []);

  return (
    <div
      className={styles.scroll}
      role="region"
      tabIndex={0}
      aria-label={scrollLabel}
      aria-describedby={instructionsId}
      style={{ '--column-count': columns.length } as CSSProperties}
    >
      <p id={instructionsId} className="sr-only">
        Activate an expand or collapse button with Enter or Space. Each row describes its
        level and ancestors. Scroll horizontally to reach additional columns.
      </p>
      <table className={styles.table}>
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          <col className={styles.nameColumn} />
          {columns.map((column) => (
            <col key={column.id} className={styles.valueColumn} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className={styles.nameHeader}>
              <span className="sr-only">{rowHeaderLabel}</span>
            </th>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                id={`${tableId}-column-${encodeURIComponent(column.id)}`}
                style={{ textAlign: column.align ?? 'right' }}
              >
                <span aria-hidden={column.headerLabel ? true : undefined}>{column.header}</span>
                {column.headerLabel ? <span className="sr-only">{column.headerLabel}</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map(({ row, context }) => {
            const id = getRowId(row);
            const domId = encodeURIComponent(id);
            const label = getRowLabel(row);
            const hasChildren = context.children.length > 0;
            const headerId = `${tableId}-row-${domId}`;
            const descriptionId = `${tableId}-description-${domId}`;
            const emptyStateId = `${tableId}-empty-${domId}`;
            const expansionState = context.expanded ? 'expanded' : 'collapsed';
            const availabilityDescription = hasChildren
              ? `${context.children.length} child rows, ${expansionState}.`
              : context.expandable
                ? `No child data available, ${expansionState}.`
                : 'No further breakdown available.';
            const hierarchyDescription = `Level ${context.depth + 1}. ${context.ancestors.length ? `Within ${context.ancestors.map(getRowLabel).join(', ')}.` : 'Top level.'} ${availabilityDescription}`;
            const content = (
              <>
                <span className={styles.indicator} aria-hidden="true">
                  {context.expandable ? (
                    <TreeChevron expanded={context.expanded} />
                  ) : null}
                </span>
                <span className={styles.label}>{renderRowLabel(row)}</span>
              </>
            );
            return (
              <Fragment key={id}>
                <tr
                  data-expandable={context.expandable || undefined}
                  data-selected={id === selectedRowId || undefined}
                  onClick={
                    context.expandable
                      ? (event) => {
                          if (
                            !(event.target instanceof Element) ||
                            event.target.closest('button, a, input, select, textarea')
                          )
                            return;
                          onToggle(id);
                        }
                      : undefined
                  }
                >
                  <th
                    scope="row"
                    id={headerId}
                    className={styles.rowHeader}
                    aria-describedby={descriptionId}
                  >
                    <div className={styles.rowHeading}>
                      {context.expandable ? (
                        <button
                          className={styles.rowLabel}
                          style={{ '--depth': context.depth } as CSSProperties}
                          onClick={() => onToggle(id)}
                          aria-expanded={context.expanded}
                          aria-label={`${context.expanded ? 'Collapse' : 'Expand'} ${label}`}
                          aria-describedby={descriptionId}
                          aria-controls={context.expanded && !hasChildren ? emptyStateId : undefined}
                          type="button"
                        >
                          {content}
                        </button>
                      ) : (
                        <div
                          className={styles.rowLabel}
                          style={{ '--depth': context.depth } as CSSProperties}
                        >
                          {content}
                        </div>
                      )}
                      {renderRowActions ? (
                        <div className={styles.rowActions}>{renderRowActions(row)}</div>
                      ) : null}
                    </div>
                    <span id={descriptionId} className="sr-only">
                      {getRowDescription?.(row, context)} {hierarchyDescription}
                    </span>
                  </th>
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      headers={`${headerId} ${tableId}-column-${encodeURIComponent(column.id)}`}
                      style={{ textAlign: column.align ?? 'right' }}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
                {context.expanded && !hasChildren ? (
                  <tr id={emptyStateId}>
                    <td className={styles.emptyCell} colSpan={columns.length + 1} headers={headerId}>
                      <div
                        className={styles.emptyState}
                        style={{ '--depth': context.depth + 1 } as CSSProperties}
                        role="status"
                        aria-label={`${label} breakdown`}
                      >
                        {renderEmptyState?.(row) ?? 'No data available.'}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
