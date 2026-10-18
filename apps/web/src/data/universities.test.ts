import { describe, expect, test } from 'bun:test';
import { TAG_SEEDS } from './tags.data';
import { loadUniversityCatalog, visibleUniversityTree } from './universities';

describe('university catalog', () => {
  test('attaches schools to the division named in the catalog location', () => {
    const catalog = loadUniversityCatalog();
    const peking = catalog.byId.get('4111010001');
    expect(peking).toMatchObject({
      name: '北京大学',
      level: 'university',
      tier: 'undergraduate',
      parentId: '110000',
      placeName: '北京市',
    });
    expect(catalog.byId.get('4132010284')).toMatchObject({
      name: '南京大学',
      parentId: '320100',
      placeName: '南京市',
    });
    expect(catalog.byId.get('4132016406')).toMatchObject({
      name: '昆山杜克大学',
      parentId: '320583',
      placeName: '昆山市',
    });
    expect(catalog.byId.get('4137012330')).toMatchObject({
      name: '莱芜职业技术学院',
      tier: 'vocational',
      parentId: '370100',
      placeName: '济南市',
    });
    expect(catalog.byId.get('4165014977')).toMatchObject({
      name: '胡杨河职业技术学院',
      tier: 'vocational',
      parentId: '659010',
      placeName: '胡杨河市',
    });
    expect(catalog.byId.get('4211050001')).toMatchObject({
      name: '北京市海淀区职工大学',
      tier: 'adult',
      parentId: '110108',
      placeName: '海淀区',
    });
    expect(catalog.counts.university).toBe(3196);
    expect(catalog.tierCounts).toEqual({ undergraduate: 1412, vocational: 1540, adult: 244 });
    expect(catalog.byId.get('4111010001')?.tagIds).toEqual([
      'project_985',
      'project_211',
      'double_first_class',
      'moe_direct',
    ]);
    expect(catalog.byId.get('4111010004')?.tagIds).toEqual([
      'project_211',
      'double_first_class',
      'moe_direct',
    ]);
    expect(catalog.byId.get('4132010300')?.tagIds).toEqual(['double_first_class']);
    expect(catalog.byId.get('4111011418')?.tagIds).toEqual(['private_hei']);
    expect(catalog.byId.get('4132016406')?.tagIds).toEqual(['sino_foreign']);
    const titled = visibleUniversityTree(catalog, new Set(), '', 'all', 'all', ['project_985']);
    expect(titled).toHaveLength(38);
    expect(titled.some((row) => row.id === '4111010001')).toBe(true);
    expect(titled.some((row) => row.id === '4111010004')).toBe(false);
    const either = visibleUniversityTree(catalog, new Set(), '', 'all', 'all', ['project_985', 'project_211']);
    expect(either).toHaveLength(112);
    expect(either.some((row) => row.id === '4111010001')).toBe(true);
    expect(either.some((row) => row.id === '4111010004')).toBe(true);
  });

  test('university titles are a nationwide tag group', () => {
    const group = TAG_SEEDS.find((row) => row.id === 'university_title');
    expect(group).toMatchObject({ name: '高校称号', level: 'group', scopeId: '' });
    expect(TAG_SEEDS.filter((row) => row.parent === 'university_title').map((row) => row.name)).toEqual([
      '985工程',
      '211工程',
      '双一流',
      '教育部直属',
      '民办',
      '中外合作办学',
    ]);
  });
});
