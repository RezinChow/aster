import '../pages/secondaryBack.dom';
import { afterEach, describe, expect, test } from 'bun:test';
import { resetBrand, setBrandName, setDocumentSurface, setLocale } from './store';

describe('document title follows brand and locale', () => {
  afterEach(() => {
    resetBrand();
    setLocale('zh');
    setDocumentSurface('plain');
  });

  test('a brand rename keeps the console suffix', () => {
    setDocumentSurface('admin');
    setBrandName('Acme');
    expect(document.title).toBe('Acme - 管理后台');
    setLocale('en');
    expect(document.title).toBe('Acme - Admin Console');
  });
});
