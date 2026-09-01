import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal, ModalBody, ModalFooter } from './Modal';

describe('Modal accessibility', () => {
  it('names the dialog, traps focus, closes on Escape and restores focus', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(
      <>
        <button type="button">Open dialog</button>
        <Modal isOpen={false} onClose={onClose} title="Confirm shipment">
          <ModalBody>Review the shipment.</ModalBody>
          <ModalFooter><button type="button">Confirm</button></ModalFooter>
        </Modal>
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    trigger.focus();

    rerender(
      <>
        <button type="button">Open dialog</button>
        <Modal isOpen onClose={onClose} title="Confirm shipment">
          <ModalBody>Review the shipment.</ModalBody>
          <ModalFooter><button type="button">Confirm</button></ModalFooter>
        </Modal>
      </>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Confirm shipment' });
    const close = screen.getByRole('button', { name: 'Close modal' });
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    expect(dialog).toHaveFocus();

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<button type="button">Open dialog</button>);
    expect(screen.getByRole('button', { name: 'Open dialog' })).toHaveFocus();
  });
});
