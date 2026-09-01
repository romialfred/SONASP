import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Tabs } from './index';

type Tab = 'overview' | 'documents' | 'history';

function Harness() {
  const [value, setValue] = useState<Tab>('overview');
  return (
    <Tabs<Tab>
      value={value}
      options={[
        { value: 'overview', label: 'Overview' },
        { value: 'documents', label: 'Documents' },
        { value: 'history', label: 'History' },
      ]}
      onChange={setValue}
      ariaLabel="Shipment details"
    />
  );
}

describe('Tabs keyboard navigation', () => {
  it('moves both selection and focus with arrows, Home and End', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const overview = screen.getByRole('tab', { name: 'Overview' });
    const documents = screen.getByRole('tab', { name: 'Documents' });
    const history = screen.getByRole('tab', { name: 'History' });

    overview.focus();
    await user.keyboard('{ArrowRight}');
    expect(documents).toHaveFocus();
    expect(documents).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{End}');
    expect(history).toHaveFocus();
    expect(history).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Home}');
    expect(overview).toHaveFocus();
    expect(overview).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowLeft}');
    expect(history).toHaveFocus();
    expect(history).toHaveAttribute('aria-selected', 'true');
  });
});
