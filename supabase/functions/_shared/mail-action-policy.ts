export const MAIL_ACTION_CAPABILITIES = {
  bienvenue: 'accounts.manage',
  reinitialisation: 'accounts.manage',
  test: 'email.settings.manage',
  file: 'sonasp.workflow.read',
} as const;

export type MailAction = keyof typeof MAIL_ACTION_CAPABILITIES;

export function normalizeMailAction(value: unknown): MailAction | null {
  const action = value === undefined || value === null || value === ''
    ? 'file'
    : String(value).trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(MAIL_ACTION_CAPABILITIES, action)
    ? action as MailAction
    : null;
}

export function requiredCapabilityForMailAction(action: MailAction): string {
  return MAIL_ACTION_CAPABILITIES[action];
}
