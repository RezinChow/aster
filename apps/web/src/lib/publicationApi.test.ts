import { describe, expect, test } from 'bun:test';
import { publicationErrorKey } from './publicationApi';

describe('publicationErrorKey', () => {
  test('maps the closed publish refusals', () => {
    expect(publicationErrorKey('effective date is required')).toBe('settings.notices.error.effective');
    expect(publicationErrorKey('body is required in both locales')).toBe('settings.notices.error.body');
    expect(publicationErrorKey('support details are required')).toBe('settings.notices.error.support');
    expect(publicationErrorKey('publication not found')).toBeNull();
  });
});
