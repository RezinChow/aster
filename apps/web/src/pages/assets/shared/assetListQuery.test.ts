import { describe, expect, test } from 'bun:test';
import { readAssetListQuery, writeAssetListQuery, type AssetListState } from './assetListQuery';

const options = {
  sort: 'recommended',
  sorts: ['recommended', 'installs', 'updated', 'name'],
  filterKeys: ['category', 'author', 'tag', 'status'],
};

describe('asset list query string', () => {
  test('reads query, sort, page, and named filters', () => {
    const params = new URLSearchParams(
      'q=fetch&sort=installs&page=3&status=enabled&category=tools&extra=no',
    );
    expect(readAssetListQuery(params, options)).toEqual({
      q: 'fetch',
      sort: 'installs',
      page: 3,
      filters: { category: 'tools', author: '', tag: '', status: 'enabled' },
    });
  });

  test('omits the default sort, the first page, and empty filters', () => {
    const written = writeAssetListQuery(
      {
        q: '',
        sort: 'recommended',
        page: 1,
        filters: { category: '', author: '', tag: '', status: 'disabled' },
      },
      { sort: 'recommended' },
    );
    expect(written.toString()).toBe('status=disabled');
  });

  test('round-trips a non-default query', () => {
    const state: AssetListState = {
      q: 'a b',
      sort: 'name',
      page: 2,
      filters: { category: 'nlp', author: '', tag: 'mcp', status: '' },
    };
    const params = writeAssetListQuery(state, { sort: 'recommended' });
    expect(readAssetListQuery(params, options)).toEqual(state);
  });

  test('unknown sort and a bad page fall back', () => {
    const state = readAssetListQuery(new URLSearchParams('sort=nope&page=0'), options);
    expect(state.sort).toBe('recommended');
    expect(state.page).toBe(1);
  });
});
