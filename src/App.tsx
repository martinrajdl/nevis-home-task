import { useState } from 'react';
import { getClientErrorMessage, useClientBook } from './features/clients/api';
import { buildChartModel, findNodePath, type ClientNode } from './features/clients/model';
import { ClientChart } from './features/clients/components/ClientChart';
import { ClientTable } from './features/clients/components/ClientTable';
import styles from './App.module.css';

function Dashboard({ root }: { root: ClientNode }) {
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set([root.id]));
  const [scopeId, setScopeId] = useState(root.id);
  const scopePath = findNodePath(root, scopeId) ?? [root];
  const chart = buildChartModel(scopePath.at(-1) ?? root);

  function toggleNode(id: string) {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <header className={styles.header}>
        <h1>Clients</h1>
      </header>
      <ClientChart model={chart} path={scopePath} onSelectScope={setScopeId} />
      <p className="sr-only" role="status">Chart showing {chart.scope.name}.</p>
      <ClientTable
        root={root}
        expandedIds={expandedIds}
        onToggle={toggleNode}
        selectedId={chart.scope.id}
        onSelectScope={setScopeId}
      />
    </>
  );
}

export function App() {
  const clients = useClientBook();

  return (
    <main className={styles.page}>
      {clients.isPending ? (
        <>
          <header className={styles.header}>
            <h1>Clients</h1>
          </header>
          <div className={styles.loading} role="status" aria-label="Loading client data">
            <div className={styles.loadingChart} aria-hidden="true">
              {[48, 54, 60, 66, 71, 77, 83, 56, 56, 56, 56, 88].map((height, index) => (
                <span key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
            <div className={styles.loadingTable} aria-hidden="true">
              {[0, 1, 2, 3].map((row) => (
                <span key={row} />
              ))}
            </div>
            <span className="sr-only">Loading client data…</span>
          </div>
        </>
      ) : clients.isError ? (
        <>
          <header className={styles.header}>
            <h1>Clients</h1>
          </header>
          <section className={styles.error} aria-labelledby="error-title">
            <div role="alert">
              <h2 id="error-title">We couldn’t load your clients</h2>
              <p>{getClientErrorMessage(clients.error)}</p>
            </div>
            <button className={styles.retry} onClick={() => void clients.refetch()}>
              Try again
            </button>
          </section>
        </>
      ) : (
        <Dashboard key={clients.data.id} root={clients.data} />
      )}
    </main>
  );
}
