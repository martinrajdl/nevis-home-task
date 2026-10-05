import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import fixture from '../../../../server/data/clients.json';
import { parseClientBook, type ClientNode } from '../model';
import { ClientTable } from './ClientTable';

const root = parseClientBook(fixture);
function TableHarness({ data = root }: { data?: ClientNode }) {
  const [expanded, setExpanded] = useState(new Set([data.id]));
  return (
    <ClientTable
      root={data}
      expandedIds={expanded}
      onToggle={(id) =>
        setExpanded((old) => {
          const next = new Set(old);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        })
      }
    />
  );
}

describe('expandable client table', () => {
  it('opens and closes nested rows with Enter and Space while retaining focus and descendant expansion', async () => {
    const user = userEvent.setup();
    render(<TableHarness />);
    const branch = screen.getByRole('button', { name: 'Expand Branch 1' });
    branch.focus();
    await user.keyboard('{Enter}');
    expect(branch).toHaveAttribute('aria-expanded', 'true');
    expect(branch).toHaveFocus();
    const anna = screen.getByRole('button', { name: 'Expand Anna Blackwood' });
    anna.focus();
    await user.keyboard(' ');
    expect(anna).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Existing clients', { exact: true })).toBeVisible();
    branch.focus();
    await user.keyboard(' ');
    expect(screen.queryByText('Existing clients', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText('Anna Blackwood', { exact: true })).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(screen.getByText('Existing clients', { exact: true })).toBeVisible();
  });
  it('uses both the row name and numeric cells as pointer disclosure targets', async () => {
    const user = userEvent.setup();
    render(<TableHarness />);
    await user.click(screen.getByText('Branch 1', { exact: true }));
    expect(screen.getByText('Anna Blackwood', { exact: true })).toBeVisible();
    const row = screen.getByRole('button', { name: 'Collapse Branch 1' }).closest('tr')!;
    await user.click(within(row).getAllByRole('cell')[0]!);
    expect(screen.queryByText('Anna Blackwood', { exact: true })).not.toBeInTheDocument();
  });
  it('exposes hierarchy and keeps terminal acquisition channels non-interactive', async () => {
    const user = userEvent.setup();
    render(<TableHarness />);
    expect(screen.getByRole('button', { name: 'Expand Branch 2' })).toBeInTheDocument();
    expect(screen.getByText('Branch 2', { exact: true }).closest('th')).toHaveAccessibleDescription(
      /Level 2.*Within Company.*No child data available/,
    );
    await user.click(screen.getByRole('button', { name: 'Expand Branch 1' }));
    expect(
      screen.getByRole('button', { name: 'Expand Anna Blackwood' }),
    ).toHaveAccessibleDescription(/Level 3.*Within Company, Branch 1/);
    expect(screen.getByRole('button', { name: 'Expand James Walker' })).toHaveAccessibleDescription(
      /Level 3.*Within Company, Branch 1.*No child data available/,
    );
    await user.click(screen.getByRole('button', { name: 'Expand Anna Blackwood' }));
    expect(screen.getByText('New paid', { exact: true }).closest('th')).toHaveAccessibleDescription(
      /Level 4.*Within Company, Branch 1, Anna Blackwood/,
    );
    expect(screen.queryByRole('button', { name: 'Expand New paid' })).not.toBeInTheDocument();
  });
  it.each(['Branch 2', 'Branch 3'])('opens an empty %s from the keyboard and closes it from its numeric cells', async (name) => {
    const user = userEvent.setup();
    render(<TableHarness />);
    const branch = screen.getByRole('button', { name: `Expand ${name}` });
    branch.focus();
    await user.keyboard('{Enter}');
    expect(branch).toHaveFocus();
    expect(branch).toHaveAttribute('aria-expanded', 'true');
    const emptyState = screen.getByRole('status', { name: `${name} breakdown` });
    expect(emptyState).toHaveTextContent('No advisor data available.');
    expect(branch).toHaveAttribute('aria-controls', emptyState.closest('tr')!.id);
    await user.click(within(branch.closest('tr')!).getAllByRole('cell')[0]!);
    expect(screen.queryByRole('status', { name: `${name} breakdown` })).not.toBeInTheDocument();
    expect(branch).toHaveAttribute('aria-expanded', 'false');
  });
  it('shows an advisor empty state and retains it when its parent is collapsed and reopened', async () => {
    const user = userEvent.setup();
    render(<TableHarness />);
    await user.click(screen.getByRole('button', { name: 'Expand Branch 1' }));
    const advisor = screen.getByRole('button', { name: 'Expand James Walker' });
    advisor.focus();
    await user.keyboard(' ');
    expect(advisor).toHaveFocus();
    expect(screen.getByRole('status', { name: 'James Walker breakdown' })).toHaveTextContent(
      'No acquisition channel data available.',
    );
    await user.click(screen.getByRole('button', { name: 'Collapse Branch 1' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand Branch 1' }));
    expect(screen.getByRole('status', { name: 'James Walker breakdown' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Collapse James Walker' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('shows an empty company without inventing branch rows', () => {
    render(<TableHarness data={{ ...root, children: [] }} />);
    expect(screen.getByRole('status', { name: 'Company breakdown' })).toHaveTextContent(
      'No branch data available.',
    );
    expect(screen.getAllByRole('rowheader')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^Explain/ })).not.toBeInTheDocument();
  });
  it('keeps the original figures and all twelve explicit month headers', () => {
    render(<TableHarness />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader')).toHaveLength(13);
    expect(within(table).getByRole('columnheader', { name: 'January 2025' })).toBeInTheDocument();
    const company = within(table).getAllByRole('row')[1]!;
    expect(
      within(company)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['250', '267', '284', '301', '317', '334', '350', '250', '250', '250', '250', '350']);
  });
  it('explains all seven differences using the immediate children without expanding rows', async () => {
    const user = userEvent.setup();
    render(<TableHarness />);
    await user.click(screen.getByRole('button', { name: 'Expand Branch 1' }));
    const expected = [
      ['Company', 'May 2024', '301', 'Sum of branches', '279'],
      ['Branch 1', 'August 2024', '214', 'Sum of advisors', '216'],
      ['Anna Blackwood', 'May 2024', '31', 'Sum of acquisition channels', '30'],
      ['Anna Blackwood', 'June 2024', '32', 'Sum of acquisition channels', '33'],
      ['Anna Blackwood', 'July 2024', '34', 'Sum of acquisition channels', '35'],
      ['Anna Blackwood', 'August 2024', '38', 'Sum of acquisition channels', '36'],
      ['Anna Blackwood', 'September 2024', '27', 'Sum of acquisition channels', '28'],
    ];
    expect(screen.getAllByRole('button', { name: /^Explain/ })).toHaveLength(7);
    const rowCount = screen.getAllByRole('row').length;
    for (const [name, month, reported, sumLabel, sum] of expected) {
      const label = `Explain ${name} total for ${month}: ${reported}`;
      const button = screen.getByRole('button', { name: label });
      await user.click(button);
      const explanation = screen.getByRole('tooltip', { name: label });
      expect(within(explanation).getByText('Reported total').nextElementSibling).toHaveTextContent(reported!);
      expect(within(explanation).getByText(sumLabel!).nextElementSibling).toHaveTextContent(sum!);
      expect(explanation).toHaveTextContent('The reported total differs from the available breakdown.');
      expect(button).toHaveAttribute('aria-describedby', explanation.id);
      expect(screen.getAllByRole('tooltip')).toHaveLength(1);
      expect(screen.getAllByRole('row')).toHaveLength(rowCount);
    }
    expect(screen.getByRole('button', { name: 'Expand Anna Blackwood' })).toBeInTheDocument();
  });
  it('opens an explanation on keyboard focus, dismisses with Escape, and reopens with Enter', async () => {
    const user = userEvent.setup();
    render(<TableHarness />);
    await user.tab();
    await user.tab();
    await user.tab();
    const label = 'Explain Company total for May 2024: 301';
    const button = screen.getByRole('button', { name: label });
    expect(button).toHaveFocus();
    expect(screen.getByRole('tooltip', { name: label })).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('tooltip', { name: label })).toBeVisible();
    await user.click(screen.getByRole('columnheader', { name: 'February 2024' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse Company' })).toBeInTheDocument();
  });
});
