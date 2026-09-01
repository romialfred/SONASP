/** Do not expose database internals, row values, tokens or signed URLs in a dialog. */
export function presentError(error: unknown) {
  const value = error && typeof error === 'object' ? error as { code?: unknown; message?: unknown } : {};
  const message = typeof error === 'string' ? error : typeof value.message === 'string' ? value.message : '';
  const code = typeof value.code === 'string' && /^[A-Z0-9_]{3,24}$/.test(value.code) ? value.code : undefined;
  if (code === 'PGRST201' || /more than one relationship|could not embed/i.test(message)) {
    return { category: 'configuration', code: code || 'PGRST201', title: 'Data connection unavailable',
      message: 'The application could not link the records needed for this page.',
      recovery: 'Try loading the data again. If the problem persists, share the diagnostic code with your administrator.' };
  }
  if (code === '42501' || /permission|row.level security|not authorized|non autoris|capacit|AAL2/i.test(message)) {
    return { category: 'access', code, title: 'Action not authorised',
      message: 'Your current session cannot perform this operation.',
      recovery: 'Check your access with an administrator. Do not create another record to bypass this restriction.' };
  }
  if (code === '40001' || /conflict|conflit|changé entre/i.test(message)) {
    return { category: 'conflict', code, title: 'This record has changed',
      message: 'Another operation updated this record before your request was completed.',
      recovery: 'Reload the record and review its current state before submitting again.' };
  }
  if (code === '23505' || /duplicate|already exists|existe déjà/i.test(message)) {
    return { category: 'duplicate', code, title: 'Record already exists',
      message: 'A record with the same reference or shipment already exists.',
      recovery: 'Open the existing record before trying to create another one.' };
  }
  if (/fetch|network|timeout|connection|réseau/i.test(message)) {
    return { category: 'network', code, title: 'Connection interrupted',
      message: 'The server response could not be confirmed.',
      recovery: 'Check your connection. For a save request, check the record before retrying to avoid duplicate entries.' };
  }
  return { category: 'operation', code, title: 'Operation could not be completed',
    message: 'The request was not confirmed by the server.',
    recovery: 'Review the information you entered. If this was a save request, check the record before trying again.' };
}
