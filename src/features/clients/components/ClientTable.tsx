import { TreeTable, type TreeTableColumn } from '../../../components/TreeTable/TreeTable';
import { TooltipButton } from '../../../components/TooltipButton/TooltipButton';
import { MONTHS, type ClientNode } from '../model';
import { ClientValue } from './ClientValue';
import styles from './ClientTable.module.css';

interface ClientTableProps {
  root: ClientNode;
  expandedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  selectedId?: string;
  onSelectScope?: (id: string) => void;
}
const columns: TreeTableColumn<ClientNode>[] = MONTHS.map((month, index) => ({
  id: month.key,
  header: <>{month.label.slice(0, 3)}<span className={styles.year}> {month.key.slice(0, 4)}</span></>,
  headerLabel: month.full,
  cell: (node) => <ClientValue node={node} month={month} index={index} />,
}));
const portraits: Record<string, string> = {
  'e3c4637b-2f21-4b7e-883e-b13ae1a6df6a': 'anna-blackwood',
  'afe9ebc0-6c35-4690-80b0-20e9bc0d8c7d': 'james-walker',
  'bb012770-02d3-4999-aa08-c11a9065235d': 'maria-gutierrez',
  '61cd9425-2d8e-456f-b228-f7e7c6a76e5d': 'robert-chen',
  '3e4efd29-e7e4-4695-a1dc-6f3b0853c19d': 'sarah-smith',
};
const kindLabels = {
  company: 'Company',
  branch: 'Branch',
  employee: 'Advisor',
  channel: 'Acquisition channel',
};
const emptyMessages = {
  company: 'No branch data available.',
  branch: 'No advisor data available.',
  employee: 'No acquisition channel data available.',
  channel: 'No further breakdown available.',
};

export function ClientTable({ root, expandedIds, onToggle, selectedId, onSelectScope }: ClientTableProps) {
  return (
    <section className={styles.section} aria-label="Monthly client details">
      <TreeTable
        rows={[root]}
        columns={columns}
        getRowId={(node) => node.id}
        getRowLabel={(node) => node.name}
        getChildren={(node) => node.children}
        canExpandRow={(node) => node.kind !== 'channel'}
        expandedIds={expandedIds}
        onToggle={onToggle}
        selectedRowId={selectedId === root.id ? undefined : selectedId}
        renderRowActions={onSelectScope ? (node) => (
          <TooltipButton
            className={styles.chartAction}
            type="button"
            aria-label={`Show ${node.name} in chart`}
            aria-pressed={node.id === selectedId}
            aria-controls="client-chart"
            tooltip={`Show ${node.name} in chart`}
            onClick={() => onSelectScope(node.id)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 12V8m5 4V3m5 9V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </TooltipButton>
        ) : undefined}
        caption="Reported clients by month, February 2024 to January 2025"
        rowHeaderLabel="Company, branches, advisors, and channels"
        scrollLabel="Monthly client figures, horizontally scrollable"
        getRowDescription={(node) => `${kindLabels[node.kind]}.`}
        renderEmptyState={(node) => emptyMessages[node.kind]}
        renderRowLabel={(node) => (
          <>
            {node.kind === 'employee' ? (
              portraits[node.id] ? (
                <img
                  className={styles.avatar}
                  src={`/avatars/${portraits[node.id]}.png`}
                  alt=""
                  width="20"
                  height="20"
                />
              ) : (
                <span className={styles.avatarFallback} aria-hidden="true">
                  {node.name[0]}
                </span>
              )
            ) : null}
            <span className={styles.name} title={node.name}>{node.name}</span>
          </>
        )}
      />
      <p className={styles.mobileHint} aria-hidden="true">
        Scroll to see all months <span>↔</span>
      </p>
    </section>
  );
}
