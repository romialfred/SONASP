import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from './Input';
import { Select } from './Select';
import { TextArea } from './TextArea';

describe('accessible field descriptions', () => {
  it.each([
    ['input', <Input label="Reference" error="Reference required" />],
    ['select', <Select label="Status" error="Status required"><option value="">Choose</option></Select>],
    ['textarea', <TextArea label="Notes" error="Notes required" />],
  ])('associates the %s error with its field', (_kind, component) => {
    render(component);
    const field = screen.getByLabelText(/Reference|Status|Notes/);
    const message = screen.getByText(/required/);
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAttribute('aria-describedby', message.id);
  });

  it('preserves an existing description while adding helper text', () => {
    render(<><span id="external-help">External</span><Input aria-label="Amount" aria-describedby="external-help" helperText="In USD" /></>);
    const field = screen.getByRole('textbox', { name: 'Amount' });
    expect(field.getAttribute('aria-describedby')?.split(' ')).toEqual([
      'external-help',
      screen.getByText('In USD').id,
    ]);
  });
});
