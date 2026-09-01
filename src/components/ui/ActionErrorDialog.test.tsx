import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ActionErrorDialog } from './ActionErrorDialog';
import { BusinessErrorDialog } from './BusinessErrorDialog';

describe('ActionErrorDialog', () => {
  it('names the dialog, traps keyboard focus and restores it on close', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger); trigger.focus();
    const onClose = vi.fn();
    const { unmount } = render(<ActionErrorDialog isOpen onClose={onClose} message="Data unavailable" diagnosticCode="PGRST201" />);
    const dialog = screen.getByRole('alertdialog', { name: 'Unable to complete this action' });
    expect(dialog).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Close error dialog' })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    expect(trigger).toHaveFocus(); expect(document.body.style.overflow).not.toBe('hidden'); trigger.remove();
  });
  it('offers recovery and an explicit retry without automatic resubmission', () => {
    const retry = vi.fn();
    render(<ActionErrorDialog isOpen onClose={vi.fn()} message="Records unavailable" recovery="Check your connection" actionLabel="Reload records" onAction={retry} />);
    expect(screen.getByText('Check your connection')).toBeInTheDocument();
    expect(retry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reload records' })); expect(retry).toHaveBeenCalledOnce();
  });
  it('does not expose SQL, signed URLs or row values through the legacy wrapper', () => {
    render(<BusinessErrorDialog isOpen onClose={vi.fn()} message="Could not embed because more than one relationship was found for freight_customs_operations" technicalDetails="https://private.example/file?token=secret" />);
    expect(screen.getByText('Data connection unavailable')).toBeInTheDocument();
    expect(screen.getByText('PGRST201')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('freight_customs_operations'); expect(document.body).not.toHaveTextContent('token=secret');
  });
});
