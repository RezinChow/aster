import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import {
  parseTenantInfo,
  serializeTenantInfo,
  tenantInfoFromRecord,
  tenantLogoUrl,
  tenantMarkUrl,
} from './tenantInfo';

const toyouPath = path.resolve(import.meta.dir, '../../public/tenant/toyou/INFO.md');
const kensePath = path.resolve(import.meta.dir, '../../public/tenant/kense/INFO.md');
const a3sPath = path.resolve(import.meta.dir, '../../public/tenant/a3s/INFO.md');

describe('parseTenantInfo', () => {
  test('toyou INFO.md maps each surface to the matching logo file', () => {
    const info = parseTenantInfo(readFileSync(toyouPath, 'utf8'));
    expect(info.slug).toBe('toyou');
    expect(info.name.zh).toBe('通友科技');
    expect(info.name.en).toBe('Toyou AI Labs');
    expect(info.product).toBe('ToWork');
    expect(info.model_service).toBe('ToGateway');
    expect(info.logos.light_surface).toBe('logo-light.png');
    expect(info.logos.dark_surface).toBe('logo-dark.png');
    expect(info.brand).toBe('#171717');
    expect(tenantLogoUrl(info, 'light')).toBe('/tenant/toyou/logo-light.png');
    expect(tenantLogoUrl(info, 'dark')).toBe('/tenant/toyou/logo-dark.png');
    expect(tenantMarkUrl(info.slug, 'light')).toBe('/tenant/toyou/mark-light.png');
    expect(tenantMarkUrl(info.slug, 'dark')).toBe('/tenant/toyou/mark-dark.png');
  });

  test('kense INFO.md is the same grammar', () => {
    const info = parseTenantInfo(readFileSync(kensePath, 'utf8'));
    expect(info.name.zh).toBe('氪锶科技');
    expect(info.name.en).toBe('Kense OS');
    expect(info.product).toBe('Kense Work');
    expect(info.model_service).toBeUndefined();
    expect(info.brand).toBe('#171717');
    expect(tenantLogoUrl(info, 'light')).toBe('/tenant/kense/logo-light.png');
    expect(tenantLogoUrl(info, 'dark')).toBe('/tenant/kense/logo-dark.png');
  });

  test('serialize round-trips toyou, kense, and a3s', () => {
    for (const file of [toyouPath, kensePath, a3sPath]) {
      const info = parseTenantInfo(readFileSync(file, 'utf8'));
      expect(parseTenantInfo(serializeTenantInfo(info))).toEqual(info);
      expect(tenantInfoFromRecord(info)).toEqual(info);
    }
  });

  test('unknown keys and a quoted version fail', () => {
    const text = readFileSync(toyouPath, 'utf8');
    expect(() => parseTenantInfo(text.replace('version: 1', 'version: "1"'))).toThrow(/version/);
    expect(() => parseTenantInfo(text.replace('slug: toyou', 'slug: toyou\nextra: "no"'))).toThrow(
      /extra/,
    );
  });
});
