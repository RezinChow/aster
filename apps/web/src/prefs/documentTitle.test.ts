import { describe, expect, test } from 'bun:test';
import {
  documentSurfaceForPath,
  formatConsoleDocumentTitle,
} from './documentTitle';

describe('console document title', () => {
  test('the console uses the platform name plus a fixed suffix', () => {
    expect(formatConsoleDocumentTitle('A3S OS', 'admin', 'zh')).toBe(
      'A3S OS - 管理后台',
    );
    expect(formatConsoleDocumentTitle('Acme', 'admin', 'zh')).toBe('Acme - 管理后台');
    expect(formatConsoleDocumentTitle('Acme', 'admin', 'en')).toBe(
      'Acme - Admin Console',
    );
    expect(formatConsoleDocumentTitle('Acme', 'plain', 'zh')).toBe('Acme');
  });

  test('path picks the surface', () => {
    expect(documentSurfaceForPath('/admin')).toBe('admin');
    expect(documentSurfaceForPath('/admin/login')).toBe('admin');
    expect(documentSurfaceForPath('/admin/users')).toBe('admin');
    expect(documentSurfaceForPath('/')).toBe('plain');
    expect(documentSurfaceForPath('/members')).toBe('plain');
  });
});
