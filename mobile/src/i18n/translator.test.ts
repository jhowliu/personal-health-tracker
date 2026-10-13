import { activateLocale, getActiveLocale, translate } from './translator';

describe('translator', () => {
  afterEach(() => activateLocale('zh-TW'));

  it('switches catalogs immediately', () => {
    activateLocale('en');

    expect(getActiveLocale()).toBe('en');
    expect(translate('settings.language')).toBe('Language');
    expect(translate('common.errors.requestFailed', { status: 503 })).toBe(
      'Request failed (503)',
    );
  });

  it('uses Traditional Chinese as the default and fallback catalog', () => {
    expect(getActiveLocale()).toBe('zh-TW');
    expect(translate('settings.language')).toBe('語言');
  });
});
