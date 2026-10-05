import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { TreeTable } from './TreeTable';

type Folder = { key: string; title: string; bytes: number; entries?: Folder[] };
const folders: Folder[] = [
  {
    key: 'docs',
    title: 'Documents',
    bytes: 42,
    entries: [{ key: 'readme', title: 'Readme', bytes: 42 }],
  },
];
function FolderTable({ items = folders, actions = false }: { items?: Folder[]; actions?: boolean }) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<string>();
  return (
    <TreeTable
      rows={items}
      columns={[{ id: 'file size', header: 'Size', cell: (row) => `${row.bytes} B` }]}
      getRowId={(row) => row.key}
      getRowLabel={(row) => row.title}
      getChildren={(row) => row.entries ?? []}
      canExpandRow={(row) => row.entries !== undefined}
      renderEmptyState={(row) => <em>No files in {row.title}.</em>}
      renderRowLabel={(row) => <strong>{row.title}</strong>}
      expandedIds={expanded}
      onToggle={(id) => setExpanded((previous) => (previous.has(id) ? new Set() : new Set([id])))}
      caption="Files"
      rowHeaderLabel="Filename"
      scrollLabel="File list"
      selectedRowId={selected}
      renderRowActions={actions ? (row) => (
        <button type="button" onClick={() => setSelected(row.key)} aria-pressed={selected === row.key}>
          Preview {row.title}
        </button>
      ) : undefined}
    />
  );
}
it('keeps an independent row action separate from expansion, including terminal rows', async () => {
  const user = userEvent.setup();
  render(<FolderTable actions />);
  await user.click(screen.getByRole('button', { name: 'Preview Documents' }));
  expect(screen.getByRole('button', { name: 'Expand Documents' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('button', { name: 'Preview Documents' }).closest('tr')).toHaveAttribute('data-selected');
  await user.click(screen.getByRole('button', { name: 'Expand Documents' }));
  const preview = screen.getByRole('button', { name: 'Preview Readme' });
  preview.focus();
  await user.keyboard(' ');
  expect(preview).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Preview Documents' })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByRole('button', { name: 'Collapse Documents' })).toBeInTheDocument();
});
it('works with a different tree shape, arbitrary columns, and custom row content', async () => {
  const user = userEvent.setup();
  render(<FolderTable />);
  await user.click(screen.getByRole('button', { name: 'Expand Documents' }));
  const leaf = screen.getByText('Readme').closest('tr')!;
  expect(within(leaf).getByRole('cell')).toHaveTextContent('42 B');
  expect(within(leaf).getByRole('rowheader')).toHaveAccessibleDescription(
    /Level 2.*Within Documents/,
  );
  expect(within(leaf).queryByRole('button')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Collapse Documents' }));
  expect(screen.queryByText('Readme')).not.toBeInTheDocument();
});
it('supports a custom empty state for empty folders while files stay non-expandable', async () => {
  const user = userEvent.setup();
  render(
    <FolderTable
      items={[
        { key: 'archive', title: 'Archive', bytes: 0, entries: [] },
        { key: 'readme', title: 'Readme', bytes: 42 },
      ]}
    />,
  );
  const folder = screen.getByRole('button', { name: 'Expand Archive' });
  folder.focus();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('status', { name: 'Archive breakdown' })).toHaveTextContent(
    'No files in Archive.',
  );
  expect(screen.queryByRole('button', { name: 'Expand Readme' })).not.toBeInTheDocument();
  await user.keyboard(' ');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(folder).toHaveFocus();
});

it('preserves header and disclosure associations for consumer IDs with spaces and punctuation', async () => {
  const user = userEvent.setup();
  const { container } = render(
    <FolderTable items={[
      { key: 'archive items', title: 'Archive', bytes: 0, entries: [] },
      { key: 'archive%20items', title: 'Encoded name', bytes: 8 },
      { key: 'archive items-description', title: 'Notes', bytes: 12 },
    ]} />,
  );
  const folder = screen.getByRole('button', { name: 'Expand Archive' });
  const row = within(folder.closest('tr')!);
  const rowHeader = row.getByRole('rowheader');
  const headers = row.getByRole('cell').getAttribute('headers')!.split(/\s+/);
  expect(headers.map((id) => document.getElementById(id))).toEqual([
    rowHeader,
    screen.getByRole('columnheader', { name: 'Size' }),
  ]);
  expect(folder).toHaveAccessibleDescription(/Level 1.*No child data available/);

  await user.click(folder);
  const emptyRow = screen.getByRole('status', { name: 'Archive breakdown' }).closest('tr');
  expect(document.getElementById(folder.getAttribute('aria-controls')!)).toBe(emptyRow);
  expect(within(emptyRow!).getByRole('cell')).toHaveAttribute('headers', rowHeader.id);

  const ids = [...container.querySelectorAll('[id]')].map((element) => element.id);
  expect(new Set(ids).size).toBe(ids.length);
});
