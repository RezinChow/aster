export type AdminRank = 'central' | 'provincial' | 'municipal' | 'county';

export type AdminOrganType =
  | 'general'
  | 'constituent'
  | 'special'
  | 'direct'
  | 'staff'
  | 'institution'
  | 'bureau'
  | 'government'
  | 'prefecture'
  | 'sar'
  | 'ting'
  | 'ju'
  | 'wei'
  | 'office'
  | 'public'
  | 'mass';

export type AdminSeed = {
  id: string;
  name: string;
  parent: string;
  kind: 'group' | 'organ';
  rank: AdminRank | '';
  organType: AdminOrganType | '';
};

function group(parent: string, id: string, name: string): AdminSeed {
  return { id, name, parent, kind: 'group', rank: '', organType: '' };
}

function organ(parent: string, id: string, name: string, organType: AdminOrganType): AdminSeed {
  return { id, name, parent, kind: 'organ', rank: 'central', organType };
}

/**
 * State Council organization after 国发〔2023〕5号 and 国发〔2023〕6号.
 * Name plates that are not separate organs are omitted.
 */
export const ADMIN_SEEDS: readonly AdminSeed[] = [
  group('', 'central', '中央行政机关'),
  group('central', 'state_council', '国务院'),
  organ('state_council', 'sc_general_office', '国务院办公厅', 'general'),
  group('state_council', 'cat_constituent', '组成部门'),
  organ('cat_constituent', 'mofa', '外交部', 'constituent'),
  organ('cat_constituent', 'mod', '国防部', 'constituent'),
  organ('cat_constituent', 'ndrc', '国家发展和改革委员会', 'constituent'),
  organ('cat_constituent', 'moe', '教育部', 'constituent'),
  organ('cat_constituent', 'most', '科学技术部', 'constituent'),
  organ('cat_constituent', 'miit', '工业和信息化部', 'constituent'),
  organ('cat_constituent', 'seac', '国家民族事务委员会', 'constituent'),
  organ('cat_constituent', 'mps', '公安部', 'constituent'),
  organ('cat_constituent', 'mss', '国家安全部', 'constituent'),
  organ('cat_constituent', 'mca', '民政部', 'constituent'),
  organ('cat_constituent', 'moj', '司法部', 'constituent'),
  organ('cat_constituent', 'mof', '财政部', 'constituent'),
  organ('cat_constituent', 'mohrss', '人力资源和社会保障部', 'constituent'),
  organ('cat_constituent', 'mnr', '自然资源部', 'constituent'),
  organ('cat_constituent', 'mee', '生态环境部', 'constituent'),
  organ('cat_constituent', 'mohurd', '住房和城乡建设部', 'constituent'),
  organ('cat_constituent', 'mot', '交通运输部', 'constituent'),
  organ('cat_constituent', 'mwr', '水利部', 'constituent'),
  organ('cat_constituent', 'mara', '农业农村部', 'constituent'),
  organ('cat_constituent', 'mofcom', '商务部', 'constituent'),
  organ('cat_constituent', 'mct', '文化和旅游部', 'constituent'),
  organ('cat_constituent', 'nhc', '国家卫生健康委员会', 'constituent'),
  organ('cat_constituent', 'mva', '退役军人事务部', 'constituent'),
  organ('cat_constituent', 'mem', '应急管理部', 'constituent'),
  organ('cat_constituent', 'pboc', '中国人民银行', 'constituent'),
  organ('cat_constituent', 'nao', '审计署', 'constituent'),
  group('state_council', 'cat_special', '直属特设机构'),
  organ('cat_special', 'sasac', '国务院国有资产监督管理委员会', 'special'),
  group('state_council', 'cat_direct', '直属机构'),
  organ('cat_direct', 'customs', '海关总署', 'direct'),
  organ('cat_direct', 'sta', '国家税务总局', 'direct'),
  organ('cat_direct', 'samr', '国家市场监督管理总局', 'direct'),
  organ('cat_direct', 'nfra', '国家金融监督管理总局', 'direct'),
  organ('cat_direct', 'csrc', '中国证券监督管理委员会', 'direct'),
  organ('cat_direct', 'nrta', '国家广播电视总局', 'direct'),
  organ('cat_direct', 'sport', '国家体育总局', 'direct'),
  organ('cat_direct', 'petition', '国家信访局', 'direct'),
  organ('cat_direct', 'nbs', '国家统计局', 'direct'),
  organ('cat_direct', 'cnipa', '国家知识产权局', 'direct'),
  organ('cat_direct', 'cidca', '国家国际发展合作署', 'direct'),
  organ('cat_direct', 'nhsa', '国家医疗保障局', 'direct'),
  organ('cat_direct', 'counsellors', '国务院参事室', 'direct'),
  organ('cat_direct', 'ngoa', '国家机关事务管理局', 'direct'),
  group('state_council', 'cat_staff', '办事机构'),
  organ('cat_staff', 'research', '国务院研究室', 'staff'),
  organ('cat_staff', 'overseas_chinese', '国务院侨务办公室', 'staff'),
  organ('cat_staff', 'hk_macao', '国务院港澳事务办公室', 'staff'),
  organ('cat_staff', 'taiwan', '国务院台湾事务办公室', 'staff'),
  organ('cat_staff', 'cac', '国家互联网信息办公室', 'staff'),
  organ('cat_staff', 'scio', '国务院新闻办公室', 'staff'),
  group('state_council', 'cat_institution', '直属事业单位'),
  organ('cat_institution', 'xinhua', '新华通讯社', 'institution'),
  organ('cat_institution', 'cas', '中国科学院', 'institution'),
  organ('cat_institution', 'cass', '中国社会科学院', 'institution'),
  organ('cat_institution', 'cae', '中国工程院', 'institution'),
  organ('cat_institution', 'drc', '国务院发展研究中心', 'institution'),
  organ('cat_institution', 'cmg', '中央广播电视总台', 'institution'),
  organ('cat_institution', 'cma', '中国气象局', 'institution'),
  organ('cat_institution', 'nsa', '国家行政学院', 'institution'),
  group('state_council', 'cat_bureau', '部委管理的国家局'),
  organ('cat_bureau', 'lswz', '国家粮食和物资储备局', 'bureau'),
  organ('cat_bureau', 'nea', '国家能源局', 'bureau'),
  organ('cat_bureau', 'nda', '国家数据局', 'bureau'),
  organ('cat_bureau', 'sastind', '国家国防科技工业局', 'bureau'),
  organ('cat_bureau', 'tobacco', '国家烟草专卖局', 'bureau'),
  organ('cat_bureau', 'nia', '国家移民管理局', 'bureau'),
  organ('cat_bureau', 'nfga', '国家林业和草原局', 'bureau'),
  organ('cat_bureau', 'nra', '国家铁路局', 'bureau'),
  organ('cat_bureau', 'caac', '中国民用航空局', 'bureau'),
  organ('cat_bureau', 'spb', '国家邮政局', 'bureau'),
  organ('cat_bureau', 'ncha', '国家文物局', 'bureau'),
  organ('cat_bureau', 'natcm', '国家中医药管理局', 'bureau'),
  organ('cat_bureau', 'ndcpa', '国家疾病预防控制局', 'bureau'),
  organ('cat_bureau', 'nmsa', '国家矿山安全监察局', 'bureau'),
  organ('cat_bureau', 'fire', '国家消防救援局', 'bureau'),
  organ('cat_bureau', 'safe', '国家外汇管理局', 'bureau'),
  organ('cat_bureau', 'nmpa', '国家药品监督管理局', 'bureau'),
  group('', 'local', '地方行政机关'),
];

export type LocalTier = 'province' | 'municipality' | 'city' | 'prefecture' | 'county';

export type LocalGroup = 'ting' | 'wei' | 'ju' | 'office' | 'public' | 'mass';

type LocalNames = Partial<Record<LocalTier, string>>;

export type LocalTitle = 'formal' | 'tax' | 'forex';

export type LocalDepartment = {
  code: string;
  kind: 'admin' | 'public' | 'mass';
  names: LocalNames;
  /** Overrides the default “division name + stem” when the legal name is different. */
  title?: LocalTitle;
};

/** Stems are prefixed with the division name. Empty means that tier does not set up the organ. */
export const LOCAL_DEPARTMENTS: readonly LocalDepartment[] = [
  {
    code: 'office',
    kind: 'admin',
    names: {
      province: '人民政府办公厅',
      municipality: '人民政府办公厅',
      city: '人民政府办公室',
      prefecture: '行政公署办公室',
      county: '人民政府办公室',
    },
  },
  {
    code: 'foreign',
    kind: 'admin',
    names: {
      province: '人民政府外事办公室',
      municipality: '人民政府外事办公室',
      city: '人民政府外事办公室',
      prefecture: '行政公署外事办公室',
    },
  },
  {
    code: 'research',
    kind: 'admin',
    names: { province: '人民政府研究室', municipality: '人民政府研究室' },
  },
  {
    code: 'mobilization',
    kind: 'admin',
    names: {
      province: '国防动员办公室（人民防空办公室）',
      municipality: '国防动员办公室（人民防空办公室）',
      city: '国防动员办公室（人民防空办公室）',
      prefecture: '国防动员办公室（人民防空办公室）',
    },
  },
  {
    code: 'cac',
    kind: 'admin',
    names: {
      province: '互联网信息办公室',
      municipality: '互联网信息办公室',
      city: '互联网信息办公室',
      prefecture: '互联网信息办公室',
      county: '互联网信息办公室',
    },
  },
  {
    code: 'ndrc',
    kind: 'admin',
    names: {
      province: '发展和改革委员会',
      municipality: '发展和改革委员会',
      city: '发展和改革委员会',
      prefecture: '发展和改革委员会',
      county: '发展和改革局',
    },
  },
  {
    code: 'education',
    kind: 'admin',
    names: {
      province: '教育厅',
      municipality: '教育委员会',
      city: '教育局',
      prefecture: '教育局',
      county: '教育局',
    },
  },
  {
    code: 'science',
    kind: 'admin',
    names: {
      province: '科学技术厅',
      municipality: '科学技术委员会',
      city: '科学技术局',
      prefecture: '科学技术局',
      county: '科学技术局',
    },
  },
  {
    code: 'industry',
    kind: 'admin',
    names: {
      province: '工业和信息化厅',
      municipality: '经济和信息化局',
      city: '工业和信息化局',
      prefecture: '工业和信息化局',
      county: '工业和信息化局',
    },
  },
  {
    code: 'ethnic',
    kind: 'admin',
    names: {
      province: '民族宗教事务委员会',
      municipality: '民族宗教事务委员会',
      city: '民族宗教事务局',
      prefecture: '民族宗教事务局',
    },
  },
  {
    code: 'police',
    kind: 'admin',
    names: {
      province: '公安厅',
      municipality: '公安局',
      city: '公安局',
      prefecture: '公安局',
      county: '公安局',
    },
  },
  {
    code: 'civil',
    kind: 'admin',
    names: { province: '民政厅', municipality: '民政局', city: '民政局', prefecture: '民政局', county: '民政局' },
  },
  {
    code: 'justice',
    kind: 'admin',
    names: { province: '司法厅', municipality: '司法局', city: '司法局', prefecture: '司法局', county: '司法局' },
  },
  {
    code: 'finance',
    kind: 'admin',
    names: { province: '财政厅', municipality: '财政局', city: '财政局', prefecture: '财政局', county: '财政局' },
  },
  {
    code: 'hr',
    kind: 'admin',
    names: {
      province: '人力资源和社会保障厅',
      municipality: '人力资源和社会保障局',
      city: '人力资源和社会保障局',
      prefecture: '人力资源和社会保障局',
      county: '人力资源和社会保障局',
    },
  },
  {
    code: 'natural',
    kind: 'admin',
    names: {
      province: '自然资源厅',
      municipality: '规划和自然资源委员会',
      city: '自然资源和规划局',
      prefecture: '自然资源局',
      county: '自然资源局',
    },
  },
  {
    code: 'environment',
    kind: 'admin',
    names: {
      province: '生态环境厅',
      municipality: '生态环境局',
      city: '生态环境局',
      prefecture: '生态环境局',
      county: '生态环境局',
    },
  },
  {
    code: 'housing',
    kind: 'admin',
    names: {
      province: '住房和城乡建设厅',
      municipality: '住房和城乡建设委员会',
      city: '住房和城乡建设局',
      prefecture: '住房和城乡建设局',
      county: '住房和城乡建设局',
    },
  },
  {
    code: 'transport',
    kind: 'admin',
    names: {
      province: '交通运输厅',
      municipality: '交通委员会',
      city: '交通运输局',
      prefecture: '交通运输局',
      county: '交通运输局',
    },
  },
  {
    code: 'water',
    kind: 'admin',
    names: { province: '水利厅', municipality: '水务局', city: '水利局', prefecture: '水利局', county: '水利局' },
  },
  {
    code: 'agriculture',
    kind: 'admin',
    names: {
      province: '农业农村厅',
      municipality: '农业农村局',
      city: '农业农村局',
      prefecture: '农业农村局',
      county: '农业农村局',
    },
  },
  {
    code: 'commerce',
    kind: 'admin',
    names: { province: '商务厅', municipality: '商务局', city: '商务局', prefecture: '商务局', county: '商务局' },
  },
  {
    code: 'culture',
    kind: 'admin',
    names: {
      province: '文化和旅游厅',
      municipality: '文化和旅游局',
      city: '文化和旅游局',
      prefecture: '文化和旅游局',
      county: '文化和旅游局',
    },
  },
  {
    code: 'health',
    kind: 'admin',
    names: {
      province: '卫生健康委员会',
      municipality: '卫生健康委员会',
      city: '卫生健康委员会',
      prefecture: '卫生健康委员会',
      county: '卫生健康局',
    },
  },
  {
    code: 'veterans',
    kind: 'admin',
    names: {
      province: '退役军人事务厅',
      municipality: '退役军人事务局',
      city: '退役军人事务局',
      prefecture: '退役军人事务局',
      county: '退役军人事务局',
    },
  },
  {
    code: 'emergency',
    kind: 'admin',
    names: {
      province: '应急管理厅',
      municipality: '应急管理局',
      city: '应急管理局',
      prefecture: '应急管理局',
      county: '应急管理局',
    },
  },
  {
    code: 'audit',
    kind: 'admin',
    names: { province: '审计厅', municipality: '审计局', city: '审计局', prefecture: '审计局', county: '审计局' },
  },
  {
    code: 'sasac',
    kind: 'admin',
    names: {
      province: '人民政府国有资产监督管理委员会',
      municipality: '人民政府国有资产监督管理委员会',
      city: '人民政府国有资产监督管理委员会',
      prefecture: '人民政府国有资产监督管理委员会',
    },
  },
  {
    code: 'samr',
    kind: 'admin',
    names: {
      province: '市场监督管理局',
      municipality: '市场监督管理局',
      city: '市场监督管理局',
      prefecture: '市场监督管理局',
      county: '市场监督管理局',
    },
  },
  {
    code: 'stats',
    kind: 'admin',
    names: { province: '统计局', municipality: '统计局', city: '统计局', prefecture: '统计局', county: '统计局' },
  },
  {
    code: 'medical',
    kind: 'admin',
    names: {
      province: '医疗保障局',
      municipality: '医疗保障局',
      city: '医疗保障局',
      prefecture: '医疗保障局',
      county: '医疗保障局',
    },
  },
  {
    code: 'petition',
    kind: 'admin',
    names: { province: '信访局', municipality: '信访局', city: '信访局', prefecture: '信访局', county: '信访局' },
  },
  {
    code: 'sport',
    kind: 'admin',
    names: { province: '体育局', municipality: '体育局', city: '体育局', prefecture: '体育局' },
  },
  {
    code: 'radio',
    kind: 'admin',
    names: { province: '广播电视局', municipality: '广播电视局', city: '广播电视局', prefecture: '广播电视局' },
  },
  {
    code: 'data',
    kind: 'admin',
    names: { province: '数据局', municipality: '数据局', city: '数据局', prefecture: '数据局' },
  },
  {
    code: 'financial',
    kind: 'admin',
    names: { province: '地方金融管理局', municipality: '地方金融管理局', city: '地方金融管理局' },
  },
  {
    code: 'drug',
    kind: 'admin',
    names: { province: '药品监督管理局', municipality: '药品监督管理局' },
  },
  {
    code: 'cdc_bureau',
    kind: 'admin',
    names: { province: '疾病预防控制局', municipality: '疾病预防控制局' },
  },
  {
    code: 'grain',
    kind: 'admin',
    names: { province: '粮食和物资储备局', municipality: '粮食和物资储备局', city: '粮食和物资储备局' },
  },
  {
    code: 'affairs',
    kind: 'admin',
    names: {
      province: '机关事务管理局',
      municipality: '机关事务管理局',
      city: '机关事务管理局',
      prefecture: '机关事务管理局',
    },
  },
  {
    code: 'nss',
    kind: 'admin',
    title: 'formal',
    names: { province: '国家安全厅', municipality: '国家安全局', city: '国家安全局', prefecture: '国家安全局' },
  },
  {
    code: 'tax',
    kind: 'admin',
    title: 'tax',
    names: { province: '税务局', municipality: '税务局', city: '税务局', prefecture: '税务局', county: '税务局' },
  },
  {
    code: 'meteorology',
    kind: 'admin',
    title: 'formal',
    names: { province: '气象局', municipality: '气象局', city: '气象局', prefecture: '气象局', county: '气象局' },
  },
  {
    code: 'tobacco',
    kind: 'admin',
    title: 'formal',
    names: { province: '烟草专卖局', municipality: '烟草专卖局', city: '烟草专卖局', prefecture: '烟草专卖局', county: '烟草专卖局' },
  },
  {
    code: 'post',
    kind: 'admin',
    title: 'formal',
    names: { province: '邮政管理局', municipality: '邮政管理局', city: '邮政管理局' },
  },
  {
    code: 'earthquake',
    kind: 'admin',
    title: 'formal',
    names: { province: '地震局', municipality: '地震局' },
  },
  {
    code: 'communications',
    kind: 'admin',
    title: 'formal',
    names: { province: '通信管理局', municipality: '通信管理局' },
  },
  {
    code: 'prison',
    kind: 'admin',
    title: 'formal',
    names: { province: '监狱管理局', municipality: '监狱管理局' },
  },
  {
    code: 'fire',
    kind: 'admin',
    title: 'formal',
    names: {
      province: '消防救援总队',
      municipality: '消防救援总队',
      city: '消防救援支队',
      prefecture: '消防救援支队',
      county: '消防救援大队',
    },
  },
  {
    code: 'forex',
    kind: 'admin',
    title: 'forex',
    names: { province: '外汇管理局', municipality: '外汇管理局' },
  },
  {
    code: 'liaison',
    kind: 'admin',
    names: { province: '人民政府驻北京办事处' },
  },
  { code: 'cdc', kind: 'public', names: { province: '疾病预防控制中心', municipality: '疾病预防控制中心', city: '疾病预防控制中心', prefecture: '疾病预防控制中心', county: '疾病预防控制中心' } },
  { code: 'exchange', kind: 'public', names: { province: '公共资源交易中心', municipality: '公共资源交易中心', city: '公共资源交易中心', prefecture: '公共资源交易中心', county: '公共资源交易中心' } },
  { code: 'tv', kind: 'public', names: { province: '广播电视台', municipality: '广播电视台', city: '广播电视台', prefecture: '广播电视台' } },
  { code: 'media', kind: 'public', names: { city: '融媒体中心', prefecture: '融媒体中心', county: '融媒体中心' } },
  { code: 'service', kind: 'public', names: { city: '政务服务中心', prefecture: '政务服务中心', county: '政务服务中心' } },
  { code: 'drc', kind: 'public', names: { province: '人民政府发展研究中心', municipality: '人民政府发展研究中心' } },
  { code: 'academy', kind: 'public', names: { province: '社会科学院', municipality: '社会科学院' } },
  { code: 'agri_academy', kind: 'public', names: { province: '农业科学院' } },
  { code: 'affairs_center', kind: 'public', names: { county: '机关事务服务中心' } },
  {
    code: 'archives',
    kind: 'public',
    title: 'formal',
    names: { province: '档案馆', municipality: '档案馆', city: '档案馆', prefecture: '档案馆', county: '档案馆' },
  },
  {
    code: 'socialism',
    kind: 'public',
    title: 'formal',
    names: { province: '社会主义学院', municipality: '社会主义学院', city: '社会主义学院' },
  },
  {
    code: 'union',
    kind: 'mass',
    title: 'formal',
    names: { province: '总工会', municipality: '总工会', city: '总工会', prefecture: '总工会', county: '总工会' },
  },
  {
    code: 'women',
    kind: 'mass',
    title: 'formal',
    names: { province: '妇女联合会', municipality: '妇女联合会', city: '妇女联合会', prefecture: '妇女联合会', county: '妇女联合会' },
  },
  {
    code: 'cast',
    kind: 'mass',
    title: 'formal',
    names: { province: '科学技术协会', municipality: '科学技术协会', city: '科学技术协会', prefecture: '科学技术协会', county: '科学技术协会' },
  },
  {
    code: 'cdpf',
    kind: 'mass',
    title: 'formal',
    names: { province: '残疾人联合会', municipality: '残疾人联合会', city: '残疾人联合会', prefecture: '残疾人联合会', county: '残疾人联合会' },
  },
  {
    code: 'acfic',
    kind: 'mass',
    title: 'formal',
    names: { province: '工商业联合会', municipality: '工商业联合会', city: '工商业联合会', prefecture: '工商业联合会', county: '工商业联合会' },
  },
  {
    code: 'redcross',
    kind: 'mass',
    title: 'formal',
    names: { province: '红十字会', municipality: '红十字会', city: '红十字会', prefecture: '红十字会', county: '红十字会' },
  },
  {
    code: 'qiaolian',
    kind: 'mass',
    title: 'formal',
    names: { province: '归国华侨联合会', municipality: '归国华侨联合会', city: '归国华侨联合会' },
  },
  {
    code: 'cflac',
    kind: 'mass',
    title: 'formal',
    names: { province: '文学艺术界联合会', municipality: '文学艺术界联合会', city: '文学艺术界联合会' },
  },
];

export const LOCAL_GROUP_ORDER: readonly LocalGroup[] = ['ting', 'wei', 'ju', 'office', 'public', 'mass'];

export const LOCAL_GROUP_LABEL: Record<LocalGroup, string> = {
  ting: '厅',
  wei: '委',
  ju: '局',
  office: '办',
  public: '事业单位',
  mass: '群团',
};

export function localGroupOf(stem: string, kind: 'admin' | 'public' | 'mass'): LocalGroup {
  if (kind === 'public') return 'public';
  if (kind === 'mass') return 'mass';
  const name = stem.replace(/（[^）]*）$/, '');
  if (name.endsWith('办公厅') || name.endsWith('办公室') || name.endsWith('办')) return 'office';
  if (name.endsWith('厅')) return 'ting';
  if (name.endsWith('委员会')) return 'wei';
  if (name.endsWith('局') || name.endsWith('总队') || name.endsWith('支队') || name.endsWith('大队')) return 'ju';
  return 'office';
}
