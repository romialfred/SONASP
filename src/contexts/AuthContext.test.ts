import { describe, expect, it } from 'vitest';
import { isMissingUserProfileError } from './AuthContext';

describe('isMissingUserProfileError', () => {
  it('recognizes only the PostgREST missing-row response', () => {
    expect(isMissingUserProfileError({ code: 'PGRST116' })).toBe(true);
    expect(isMissingUserProfileError({ code: '' })).toBe(false);
    expect(isMissingUserProfileError(null)).toBe(false);
  });

  it('does not treat transport or database errors as a missing profile', () => {
    expect(isMissingUserProfileError({ code: 'ERR_INTERNET_DISCONNECTED' })).toBe(false);
    expect(isMissingUserProfileError({ code: '42P17' })).toBe(false);
    expect(isMissingUserProfileError({ code: '23505' })).toBe(false);
  });
});
