export async function supprimerObjetAvecCompensation(input: {
  expectedPath: string;
  removeObject(): Promise<void>;
  deleteMetadata(): Promise<string>;
  restoreObject(): Promise<void>;
  onRestoreFailure(): void;
}): Promise<void> {
  await input.removeObject();
  try {
    const deletedPath = await input.deleteMetadata();
    if (deletedPath !== input.expectedPath) throw new Error('deleted_path_mismatch');
  } catch {
    try {
      await input.restoreObject();
    } catch {
      input.onRestoreFailure();
    }
    throw new Error('metadata_delete_failed');
  }
}
