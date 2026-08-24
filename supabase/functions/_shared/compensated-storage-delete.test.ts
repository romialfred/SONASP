import { describe, expect, it, vi } from 'vitest';
import { supprimerObjetAvecCompensation } from './compensated-storage-delete.ts';

describe('suppression Storage compensée', () => {
  it('ne restaure pas après le retour exact de la RPC', async () => {
    const restoreObject = vi.fn();
    await expect(supprimerObjetAvecCompensation({
      expectedPath: 'freight-customs/op/doc.pdf',
      removeObject: vi.fn().mockResolvedValue(undefined),
      deleteMetadata: vi.fn().mockResolvedValue('freight-customs/op/doc.pdf'),
      restoreObject,
      onRestoreFailure: vi.fn(),
    })).resolves.toBeUndefined();
    expect(restoreObject).not.toHaveBeenCalled();
  });

  it('restaure l’objet si la RPC échoue ou retourne un autre chemin', async () => {
    const restoreObject = vi.fn().mockResolvedValue(undefined);
    await expect(supprimerObjetAvecCompensation({
      expectedPath: 'freight-customs/op/doc.pdf',
      removeObject: vi.fn().mockResolvedValue(undefined),
      deleteMetadata: vi.fn().mockRejectedValue(new Error('rpc failed')),
      restoreObject,
      onRestoreFailure: vi.fn(),
    })).rejects.toThrow('metadata_delete_failed');
    expect(restoreObject).toHaveBeenCalledOnce();
  });

  it('ne touche pas la metadata si le retrait Storage échoue', async () => {
    const deleteMetadata = vi.fn();
    await expect(supprimerObjetAvecCompensation({
      expectedPath: 'freight-customs/op/doc.pdf',
      removeObject: vi.fn().mockRejectedValue(new Error('storage failed')),
      deleteMetadata,
      restoreObject: vi.fn(),
      onRestoreFailure: vi.fn(),
    })).rejects.toThrow('storage failed');
    expect(deleteMetadata).not.toHaveBeenCalled();
  });
});
