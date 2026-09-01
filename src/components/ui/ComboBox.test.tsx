import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ComboBox } from './ComboBox';

const options = [
  { value: 'mine-a', label: 'Mine A', subtitle: 'Région du Centre', icon: '⛏️' },
  { value: 'mine-b', label: 'Mine B', subtitle: 'Région du Nord' },
  { value: 'mine-c', label: 'Mine C' },
];

function ControlledComboBox({ initialValue = '' }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return (
    <ComboBox
      label="Société minière"
      value={value}
      onChange={setValue}
      options={options}
      required
    />
  );
}

function CustomControlledComboBox({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <ComboBox
      label="Mine"
      value={value}
      onChange={(nextValue) => {
        setValue(nextValue);
        onChange(nextValue);
      }}
      options={options}
      required
    />
  );
}

describe('ComboBox accessibility', () => {
  it('exposes its label, required state and popup relationship', async () => {
    const user = userEvent.setup();
    render(<ControlledComboBox initialValue="mine-b" />);

    const combobox = screen.getByRole('combobox', { name: 'Société minière' });
    expect(combobox).toHaveAttribute('aria-required', 'true');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');

    await user.click(combobox);

    const listbox = screen.getByRole('listbox', { name: 'Options pour Société minière' });
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    expect(combobox).toHaveAttribute('aria-controls', listbox.id);
    expect(screen.getByRole('searchbox', { name: 'Rechercher dans Société minière' })).toHaveFocus();
    expect(screen.getByRole('option', { name: /Mine B/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('navigates the options with arrows, Home, End and selects with Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ComboBox label="Mine" value="" onChange={onChange} options={options} allowCustom={false} />,
    );

    const combobox = screen.getByRole('combobox', { name: 'Mine' });
    combobox.focus();
    await user.keyboard('{ArrowDown}');

    const searchbox = screen.getByRole('searchbox', { name: 'Rechercher dans Mine' });
    await waitFor(() => expect(searchbox).toHaveFocus());
    expect(searchbox).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: /Mine A/ }).id);

    await user.keyboard('{ArrowDown}');
    expect(searchbox).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: /Mine B/ }).id);

    await user.keyboard('{End}');
    expect(searchbox).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: /Mine C/ }).id);

    await user.keyboard('{Home}{Enter}');
    expect(onChange).toHaveBeenCalledWith('mine-a');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(combobox).toHaveFocus());
  });

  it('filters the list and announces the empty state', async () => {
    const user = userEvent.setup();
    render(<ControlledComboBox />);

    await user.click(screen.getByRole('combobox', { name: 'Société minière' }));
    const searchbox = screen.getByRole('searchbox', { name: 'Rechercher dans Société minière' });
    await user.type(searchbox, 'Mine B');

    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: /Mine B/ })).toBeInTheDocument();

    await user.clear(searchbox);
    await user.type(searchbox, 'introuvable');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Aucun résultat trouvé');
  });

  it('closes on Escape, restores focus and does not change the value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ComboBox label="Mine" value="" onChange={onChange} options={options} />);

    const combobox = screen.getByRole('combobox', { name: 'Mine' });
    await user.click(combobox);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => expect(combobox).toHaveFocus());
  });

  it('provides a labelled custom input and preserves disabled state', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<CustomControlledComboBox onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: 'Mine' }));
    await user.click(screen.getByRole('button', { name: 'Saisir manuellement si non trouvé' }));

    const customInput = screen.getByRole('textbox', { name: 'Mine' });
    expect(customInput).toHaveFocus();
    expect(customInput).toBeRequired();
    await user.type(customInput, 'Mine indépendante');
    expect(onChange).toHaveBeenLastCalledWith('Mine indépendante');

    rerender(
      <ComboBox label="Mine" value="" onChange={onChange} options={options} disabled />,
    );
    const disabledCombobox = screen.getByRole('combobox', { name: 'Mine' });
    expect(disabledCombobox).toBeDisabled();
    await user.click(disabledCombobox);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
