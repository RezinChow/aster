import type { Locale } from '@/prefs/store';

type Labels = Record<string, { zh: string; en: string }>;

const TASK_DOMAINS: Labels = {
  multimodal: { zh: '多模态', en: 'Multimodal' },
  nlp: { zh: '自然语言处理', en: 'NLP' },
  cv: { zh: '计算机视觉', en: 'Computer vision' },
  audio: { zh: '语音', en: 'Audio' },
  science: { zh: '科学计算', en: 'Science' },
  other: { zh: '其他', en: 'Other' },
};

const TASKS: Labels = {
  'text-generation': { zh: '文本生成', en: 'Text generation' },
  'text-classification': { zh: '文本分类', en: 'Text classification' },
  'token-classification': { zh: '序列标注', en: 'Token classification' },
  translation: { zh: '翻译', en: 'Translation' },
  summarization: { zh: '文本摘要', en: 'Summarization' },
  'question-answering': { zh: '问答', en: 'Question answering' },
  'fill-mask': { zh: '完形填空', en: 'Fill mask' },
  'sentence-similarity': { zh: '句子相似度', en: 'Sentence similarity' },
  'feature-extraction': { zh: '文本向量', en: 'Feature extraction' },
  'text-ranking': { zh: '文本排序', en: 'Text ranking' },
  'image-text-to-text': { zh: '图文生成文本', en: 'Image-text to text' },
  'visual-question-answering': { zh: '视觉问答', en: 'Visual QA' },
  'image-to-text': { zh: '图像描述', en: 'Image to text' },
  'text-to-image': { zh: '文生图', en: 'Text to image' },
  'text-to-video': { zh: '文生视频', en: 'Text to video' },
  'image-to-video': { zh: '图生视频', en: 'Image to video' },
  'any-to-any': { zh: '全模态', en: 'Any to any' },
  'document-question-answering': { zh: '文档问答', en: 'Document QA' },
  'image-classification': { zh: '图像分类', en: 'Image classification' },
  'object-detection': { zh: '目标检测', en: 'Object detection' },
  'image-segmentation': { zh: '图像分割', en: 'Image segmentation' },
  'image-to-image': { zh: '图像生成图像', en: 'Image to image' },
  'depth-estimation': { zh: '深度估计', en: 'Depth estimation' },
  ocr: { zh: '文字识别', en: 'OCR' },
  'video-classification': { zh: '视频分类', en: 'Video classification' },
  'automatic-speech-recognition': { zh: '语音识别', en: 'Speech recognition' },
  'text-to-speech': { zh: '语音合成', en: 'Text to speech' },
  'audio-classification': { zh: '音频分类', en: 'Audio classification' },
  'audio-to-audio': { zh: '音频处理', en: 'Audio to audio' },
  'voice-activity-detection': { zh: '语音端点检测', en: 'Voice activity detection' },
  'protein-folding': { zh: '蛋白质结构', en: 'Protein folding' },
  'time-series-forecasting': { zh: '时序预测', en: 'Time series forecasting' },
  'tabular-classification': { zh: '表格分类', en: 'Tabular classification' },
  'reinforcement-learning': { zh: '强化学习', en: 'Reinforcement learning' },
  other: { zh: '其他', en: 'Other' },
};

const CATEGORIES: Labels = {
  office: { zh: '办公', en: 'Office' },
  creative: { zh: '创作', en: 'Creative' },
  design: { zh: '设计', en: 'Design' },
  code: { zh: '开发', en: 'Code' },
  business: { zh: '商务', en: 'Business' },
  productivity: { zh: '效率', en: 'Productivity' },
  science: { zh: '科研', en: 'Science' },
  education: { zh: '教育', en: 'Education' },
  search: { zh: '搜索', en: 'Search' },
  data: { zh: '数据', en: 'Data' },
  other: { zh: '其他', en: 'Other' },
};

const TRANSPORTS: Labels = {
  streamable_http: { zh: 'Streamable HTTP', en: 'Streamable HTTP' },
  sse: { zh: 'SSE', en: 'SSE' },
  stdio: { zh: 'stdio', en: 'stdio' },
};

const DEPLOYMENTS: Labels = {
  hosted: { zh: '托管服务', en: 'Hosted' },
  local: { zh: '本地运行', en: 'Local' },
};

const HUBS: Labels = {
  huggingface: { zh: 'Hugging Face', en: 'Hugging Face' },
  modelscope: { zh: 'ModelScope 魔搭', en: 'ModelScope' },
};

function pick(labels: Labels, value: string, locale: Locale): string {
  return labels[value]?.[locale] ?? value;
}

export const taskDomainLabel = (value: string, locale: Locale) => pick(TASK_DOMAINS, value, locale);
export const taskLabel = (value: string, locale: Locale) => pick(TASKS, value, locale);
export const categoryLabel = (value: string, locale: Locale) => pick(CATEGORIES, value, locale);
export const transportLabel = (value: string, locale: Locale) => pick(TRANSPORTS, value, locale);
export const deploymentLabel = (value: string, locale: Locale) => pick(DEPLOYMENTS, value, locale);
export const hubLabel = (value: string, locale: Locale) => pick(HUBS, value, locale);

export const TASK_DOMAIN_ORDER = ['multimodal', 'nlp', 'cv', 'audio', 'science', 'other'] as const;

const DOMAIN_COLORS: Record<string, string> = {
  multimodal: '#7C3AED',
  nlp: '#2563EB',
  cv: '#059669',
  audio: '#EA580C',
  science: '#0891B2',
  other: '#64748B',
};

/** Tile color for a model domain. Unknown domains use the neutral tile. */
export function modelDomainColor(domain: string): string {
  return DOMAIN_COLORS[domain] ?? DOMAIN_COLORS.other ?? '#64748B';
}
