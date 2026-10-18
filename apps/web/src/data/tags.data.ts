export type TagLevel = 'group' | 'tag';

export type TagGrade = 'national' | 'provincial' | 'municipal' | 'county';

export type TagSeed = {
  id: string;
  code: string;
  name: string;
  level: TagLevel;
  grade: TagGrade | '';
  parent: string;
  /** Empty on a group means the whole group is valid nationwide. Tags do not carry a region. */
  scopeId: string;
};

function group(code: string, name: string, scopeId = ''): TagSeed {
  return { id: code, code, name, level: 'group', grade: '', parent: '', scopeId };
}

function tag(parent: string, code: string, name: string, grade: TagGrade): TagSeed {
  return { id: code, code, name, level: 'tag', grade, parent, scopeId: '' };
}

/** Filter value for groups whose region is left empty (valid nationwide). */
export const TAG_SCOPE_NATIONWIDE = 'nationwide';

/**
 * Official designation and classification systems only.
 * A title is included only when a government department or exchange actually issues it,
 * and only at grades that system confers. The same title is repeated per issued grade.
 */
export const TAG_SEEDS: readonly TagSeed[] = [
  group('enterprise_title', '企业称号'),
  tag('enterprise_title', 'innovative_sme_provincial', '创新型中小企业', 'provincial'),
  tag('enterprise_title', 'specialized_provincial', '专精特新中小企业', 'provincial'),
  tag('enterprise_title', 'little_giant_national', '专精特新小巨人', 'national'),
  tag('enterprise_title', 'key_little_giant_national', '重点小巨人', 'national'),
  tag('enterprise_title', 'single_champion_national', '制造业单项冠军', 'national'),
  tag('enterprise_title', 'single_champion_provincial', '制造业单项冠军', 'provincial'),
  tag('enterprise_title', 'high_tech_national', '高新技术企业', 'national'),
  tag('enterprise_title', 'tech_sme_national', '科技型中小企业', 'national'),
  tag('enterprise_title', 'tass_national', '技术先进型服务企业', 'national'),
  tag('enterprise_title', 'tech_demo_national', '技术创新示范企业', 'national'),
  tag('enterprise_title', 'gazelle_provincial', '瞪羚企业', 'provincial'),
  tag('enterprise_title', 'gazelle_municipal', '瞪羚企业', 'municipal'),
  tag('enterprise_title', 'unicorn_provincial', '独角兽企业', 'provincial'),
  tag('enterprise_title', 'unicorn_municipal', '独角兽企业', 'municipal'),
  tag('enterprise_title', 'young_eagle_municipal', '雏鹰企业', 'municipal'),
  tag('enterprise_title', 'young_eagle_county', '雏鹰企业', 'county'),
  tag('enterprise_title', 'service_mfg_national', '服务型制造示范企业', 'national'),
  tag('enterprise_title', 'agri_leader_national', '农业产业化龙头企业', 'national'),
  tag('enterprise_title', 'agri_leader_provincial', '农业产业化龙头企业', 'provincial'),
  tag('enterprise_title', 'agri_leader_municipal', '农业产业化龙头企业', 'municipal'),
  tag('enterprise_title', 'agri_leader_county', '农业产业化龙头企业', 'county'),

  group('shanghai_titles', '上海企业称号', '310000'),
  tag('shanghai_titles', 'tech_little_giant_municipal', '科技小巨人', 'municipal'),

  group('beijing_titles', '北京企业称号', '110000'),
  tag('beijing_titles', 'gazelle_zgc', '中关村瞪羚企业', 'municipal'),

  group('innovation_platform', '创新平台'),
  tag('innovation_platform', 'national_key_lab', '全国重点实验室', 'national'),
  tag('innovation_platform', 'provincial_key_lab', '省级重点实验室', 'provincial'),
  tag('innovation_platform', 'municipal_key_lab', '市级重点实验室', 'municipal'),
  tag('innovation_platform', 'national_erc', '国家工程研究中心', 'national'),
  tag('innovation_platform', 'provincial_erc', '省级工程研究中心', 'provincial'),
  tag('innovation_platform', 'national_etc', '国家企业技术中心', 'national'),
  tag('innovation_platform', 'provincial_etc', '省级企业技术中心', 'provincial'),
  tag('innovation_platform', 'municipal_etc', '市级企业技术中心', 'municipal'),
  tag('innovation_platform', 'postdoc_station', '博士后科研工作站', 'national'),
  tag('innovation_platform', 'postdoc_base', '博士后创新实践基地', 'provincial'),
  tag('innovation_platform', 'academician_station', '院士专家工作站', 'provincial'),
  tag('innovation_platform', 'incubator_national', '科技企业孵化器', 'national'),
  tag('innovation_platform', 'incubator_provincial', '科技企业孵化器', 'provincial'),
  tag('innovation_platform', 'incubator_municipal', '科技企业孵化器', 'municipal'),
  tag('innovation_platform', 'maker_space_national', '专业化众创空间', 'national'),

  group('green_manufacturing', '绿色制造'),
  tag('green_manufacturing', 'green_factory_national', '绿色工厂', 'national'),
  tag('green_manufacturing', 'green_factory_provincial', '绿色工厂', 'provincial'),
  tag('green_manufacturing', 'green_design_national', '工业产品绿色设计示范企业', 'national'),
  tag('green_manufacturing', 'green_supply_national', '绿色供应链管理企业', 'national'),
  tag('green_manufacturing', 'smart_factory_national', '智能制造示范工厂', 'national'),
  tag('green_manufacturing', 'industrial_internet_national', '工业互联网试点示范', 'national'),

  group('intellectual_property', '知识产权'),
  tag('intellectual_property', 'ip_demo_national', '知识产权示范企业', 'national'),
  tag('intellectual_property', 'ip_demo_provincial', '知识产权示范企业', 'provincial'),
  tag('intellectual_property', 'ip_advantage_national', '知识产权优势企业', 'national'),
  tag('intellectual_property', 'ip_advantage_provincial', '知识产权优势企业', 'provincial'),

  group('quality_standard', '质量标准'),
  tag('quality_standard', 'quality_benchmark_national', '工业质量标杆', 'national'),
  tag('quality_standard', 'standard_leader_national', '企业标准领跑者', 'national'),
  tag('quality_standard', 'china_quality_award_national', '中国质量奖', 'national'),

  group('credit_compliance', '信用合规'),
  tag('credit_compliance', 'tax_credit_a', '纳税信用A级', 'national'),
  tag('credit_compliance', 'customs_aeo_advanced', '海关高级认证企业', 'national'),
  tag('credit_compliance', 'customs_aeo_general', '海关一般认证企业', 'national'),
  tag('credit_compliance', 'integration_system', '两化融合管理体系贯标', 'national'),

  group('enterprise_scale', '企业规模'),
  tag('enterprise_scale', 'scale_large', '大型', 'national'),
  tag('enterprise_scale', 'scale_medium', '中型', 'national'),
  tag('enterprise_scale', 'scale_small', '小型', 'national'),
  tag('enterprise_scale', 'scale_micro', '微型', 'national'),

  group('holding_type', '控股类型'),
  tag('holding_type', 'holding_state', '国有控股', 'national'),
  tag('holding_type', 'holding_collective', '集体控股', 'national'),
  tag('holding_type', 'holding_private', '私人控股', 'national'),
  tag('holding_type', 'holding_hmt', '港澳台商控股', 'national'),
  tag('holding_type', 'holding_foreign', '外商控股', 'national'),

  group('listing_board', '上市板块'),
  tag('listing_board', 'list_sse_main', '沪市主板', 'national'),
  tag('listing_board', 'list_szse_main', '深市主板', 'national'),
  tag('listing_board', 'list_star', '科创板', 'national'),
  tag('listing_board', 'list_chinext', '创业板', 'national'),
  tag('listing_board', 'list_bse', '北交所', 'national'),
  tag('listing_board', 'list_neeq_innovation', '新三板创新层', 'national'),
  tag('listing_board', 'list_neeq_base', '新三板基础层', 'national'),

  group('industry_role', '产业角色'),
  tag('industry_role', 'chain_master_provincial', '链主企业', 'provincial'),
  tag('industry_role', 'chain_master_municipal', '链主企业', 'municipal'),
  tag('industry_role', 'chain_master_county', '链主企业', 'county'),

  group('university_title', '高校称号'),
  tag('university_title', 'project_985', '985工程', 'national'),
  tag('university_title', 'project_211', '211工程', 'national'),
  tag('university_title', 'double_first_class', '双一流', 'national'),
  tag('university_title', 'moe_direct', '教育部直属', 'national'),
  tag('university_title', 'private_hei', '民办', 'national'),
  tag('university_title', 'sino_foreign', '中外合作办学', 'national'),
];
