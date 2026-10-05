import { InfoPopover } from '../../../components/InfoPopover/InfoPopover';
import { InvalidClientDataError, type ClientNode, type Month } from '../model';
import styles from './ClientTable.module.css';

const breakdownLabels = {
  company: 'Sum of branches',
  branch: 'Sum of advisors',
  employee: 'Sum of acquisition channels',
  channel: 'Sum of breakdown',
};

export function ClientValue({ node, month, index }: {
  node: ClientNode;
  month: Month;
  index: number;
}) {
  const reported = node.values[index];
  if (reported === undefined) throw new InvalidClientDataError();
  if (!node.children.length) return reported;
  const breakdown = node.children.reduce((sum, child) => {
    const value = child.values[index];
    if (value === undefined) throw new InvalidClientDataError();
    return sum + value;
  }, 0);
  if (reported === breakdown) return reported;

  return (
    <InfoPopover
      trigger={reported}
      label={`Explain ${node.name} total for ${month.full}: ${reported}`}
    >
      <p className={styles.explanationTitle}>{node.name} · {month.full}</p>
      <dl className={styles.totals}>
        <div><dt>Reported total</dt><dd>{reported}</dd></div>
        <div><dt>{breakdownLabels[node.kind]}</dt><dd>{breakdown}</dd></div>
      </dl>
      <p className={styles.explanationNote}>
        The reported total differs from the available breakdown.
      </p>
    </InfoPopover>
  );
}
