// Chinese copy: upload page, outline page and template selection.
export const ZH = {
  // Upload page.
  'app/(presentation-generator)/upload/page.tsx': [
    ['Turn Ideas into Slides', '让想法变成幻灯片'],
    ['Turn prompts or documents into presentations with AI', '用 AI 将提示词或文档变成演示文稿']
  ],
  'app/(presentation-generator)/upload/components/UploadPage.tsx': [
    ['Image provider unavailable', '图片服务不可用'],
    ['Unable to reach {0} right now. Please check your API key/settings and try again.', '暂时无法连接 {0}，请检查 API 密钥或设置后重试。'],
    ['Language required', '请选择语言'],
    ['Please select a language.', '生成前请先选择语言。'],
    ['Please choose a language before processing uploaded documents.', '处理上传的文档前，请先选择语言。'],
    ['Input required', '请输入内容'],
    ['Provide a prompt or upload a document.', '请输入提示词或上传文档。'],
    ['Processing documents...', '正在处理文档…'],
    ['It might take a few minutes for large documents.', '文档较大时可能需要几分钟。'],
    ['Generating presentation outline...', '正在生成演示文稿大纲…'],
    ['Preparing outline generation...', '正在准备生成大纲…'],
    ['Generation failed', '生成失败'],
    ['Something went wrong while starting your presentation.', '创建演示文稿时出错了。']
  ],
  'app/(presentation-generator)/upload/components/PromptInput.tsx': [
    ['Presentation brief', '演示文稿简介'],
    ['Describe your topic, audience, and key points, or attach supporting documents.', '描述主题、受众和要点，或附上参考文档。']
  ],
  'app/(presentation-generator)/upload/components/SupportingDoc.tsx': [
    ['Some files are not supported', '部分文件不受支持'],
    ['Supported: Word, PowerPoint, spreadsheets, PDF/TXT, and image files.', '支持 Word、PowerPoint、电子表格、PDF/TXT 和图片文件。'],
    ['Maximum file limit reached', '已达文件数量上限'],
    ['You can upload up to {0} documents only.', '最多只能上传 {0} 个文档。'],
    ['Files selected', '已选择文件'],
    ['{0} file(s) have been added.', '已添加 {0} 个文件。'],
    ['Attached files', '已附加的文件', 'aria-label'],
    ['Remove {0}', '移除 {0}'],
    ['Generate presentation', '生成演示文稿', 'aria-label']
  ],
  'app/(presentation-generator)/upload/components/ConfigurationSelects.tsx': [
    ['{0} slides', '{0} 页'],
    ['Auto slides', '自动页数'],
    ['Slides {0}', '{0} 页'],
    ['Select language', '选择语言'],
    ['Search language...', '搜索语言…'],
    ['No language found.', '未找到该语言'],
    ['slides', '页', 'jsx']
  ],
  'app/(presentation-generator)/upload/components/AdvanceSettings.tsx': [
    ['Advanced settings', '高级设置'],
    ['Close advanced settings', '关闭高级设置'],
    ['Advanced Settings', '高级设置'],
    ['Adjust Presentation Behavior', '调整演示文稿的生成方式'],
    ['Save', '保存'],
    ['Write instructions', '填写说明'],
    ['Guide the AI: define audience, tone, key points, or constraints.', '引导 AI：说明受众、语气、要点或限制条件。'],
    ['Tone', '语气'],
    ['Select tone', '选择语气'],
    ['Verbosity', '详略程度'],
    ['Select verbosity', '选择详略程度'],
    ['Title Slide', '标题页']
  ],

  // Outline page.
  'app/(presentation-generator)/outline/hooks/useOutlineStreaming.ts': [
    ['Outline ready', '大纲已生成'],
    ['Preparing your presentation outline', '正在准备演示文稿大纲'],
    ['Reconnecting to outline stream', '正在重新连接大纲生成'],
    ['Stream parse failed', '大纲解析失败'],
    ['Failed to parse outline stream response.', '无法解析生成的大纲。'],
    ['Parse failed', '解析失败'],
    ['Failed to parse presentation data.', '无法解析演示文稿数据。'],
    ['Outline streaming failed', '大纲生成失败'],
    ['Connection failed', '连接失败'],
    ['Failed to connect to the server. Please try again.', '无法连接服务器，请重试。', 'notify.error']
  ],
  'app/(presentation-generator)/outline/hooks/usePresentationGeneration.ts': [
    ['Outlines not ready', '大纲尚未就绪'],
    ['Please wait for your outlines to finish generating before continuing.', '请等大纲生成完成后再继续。'],
    ['Template not selected', '未选择模板'],
    ['Choose a template before generating your presentation.', '生成演示文稿前，请先选择模板。'],
    ['Slide limit reached', '已达页数上限', 'notify.warning'],
    ['Use {0} or fewer outline slides before generating.', '大纲不能超过 {0} 页，请删减后再生成。'],
    ['Generating presentation data...', '正在生成演示文稿数据…'],
    ['Generation error', '生成出错'],
    ['Error in presentation generation.', '生成演示文稿时出错。']
  ],
  'app/(presentation-generator)/outline/hooks/useOutlineManagement.ts': [
    ['Slide limit reached', '已达页数上限', 'notify.warning'],
    ['You can have up to {0} outline slides.', '大纲最多只能有 {0} 页。']
  ],
  'app/(presentation-generator)/outline/components/OutlinePage.tsx': [
    ['Outline ready', '大纲已生成'],
    ['Please select a template first', '请先选择模板'],
    ['Please select language', '请选择语言'],
    ['Please choose a language before regenerating from documents', '根据文档重新生成前，请先选择语言'],
    ['No Prompt or Document Provided', '请输入提示词或提供文档'],
    ['Outline Error', '大纲出错'],
    ['Failed to regenerate outline.', '重新生成大纲失败。'],
    ['Outline Generation', '生成大纲'],
    ['Select Template', '选择模板']
  ],
  'app/(presentation-generator)/outline/components/OutlineStandardHeader.tsx': [
    ['Go to dashboard', '返回首页', 'aria-label'],
    ['Back', '返回']
  ],
  'app/(presentation-generator)/outline/components/OutlinePromptBar.tsx': [
    ['Prompt', '提示词'],
    ['Describe the presentation you want to generate', '描述你想生成的演示文稿'],
    ['Regenerate outline', '重新生成大纲']
  ],
  'app/(presentation-generator)/outline/components/OutlineContent.tsx': [
    ['Maximum {0} slides', '最多 {0} 页'],
    ['Maximum {0} slides reached', '已达上限 {0} 页'],
    ['+ Add New Slide', '+ 添加页面'],
    ['No outlines available', '暂无大纲'],
    ['+ Add First Slide', '+ 添加第一页']
  ],
  'app/(presentation-generator)/outline/components/OutlineItem.tsx': [
    ['Move slide {0}', '移动第 {0} 页'],
    ['Slide:', '页码'],
    ['Enter markdown content here...', '在此输入 Markdown 内容…'],
    ['Edit slide {0} markdown', '编辑第 {0} 页的 Markdown']
  ],
  'app/(presentation-generator)/outline/components/GenerateButton.tsx': [
    ['Continue', '继续'],
    ['Loading...', '加载中…'],
    ['Select a Template', '选择模板']
  ],
  'app/(presentation-generator)/outline/components/EmptyStateView.tsx': [
    ['No Presentation Found', '未找到演示文稿'],
    ["It looks like the presentation you are looking for is not found. Let's create a brand new presentation!", '没有找到你要的演示文稿。来新建一个吧！'],
    ['Create New Presentation', '新建演示文稿']
  ],

  // Template selection.
  'app/(presentation-generator)/outline/components/TemplateSelection.tsx': [
    ['Templates could not be loaded: {0}', '无法加载模板：{0}'],
    ['Suggested template selected.', '已选中推荐模板。'],
    ['Click the highlighted template to continue.', '点击高亮的模板继续。'],
    ['Templates', '模板', 'label']
  ],
  'app/(presentation-generator)/components/TemplateListUi.tsx': [
    ['Suggested', '推荐'],
    ['Loading templates...', '正在加载模板…'],
    ['No templates available.', '暂无可用模板。']
  ],
  'app/(presentation-generator)/components/TemplatePreviewComponents.tsx': [
    ['Layouts-', '版式 ']
  ],
  'app/(presentation-generator)/hooks/useTemplateSummaries.ts': [
    ['The template service could not be reached. Please try again.', '无法连接模板服务，请重试。'],
    ['Could not load templates', '无法加载模板']
  ],

  // Errors that reach toasts.
  'app/(presentation-generator)/services/api/api-error-handler.ts': [
    ['Bad request. Please check your input and try again.', '请求有误，请检查输入后重试。'],
    ['Unauthorized. Please log in and try again.', '未授权，请登录后重试。'],
    ["Access forbidden. You don't have permission to perform this action.", '无权执行此操作。'],
    ['Resource not found. The requested item may have been deleted or moved.', '未找到所请求的内容，可能已被删除或移动。'],
    ["Conflict. The resource already exists or there's a conflict with the current state.", '操作冲突：内容已存在，或与当前状态冲突。'],
    ['Validation error. Please check your input and try again.', '校验失败，请检查输入后重试。'],
    ['Too many requests. Please wait a moment and try again.', '请求过于频繁，请稍后重试。'],
    ['Internal server error. Please try again later.', '服务器内部错误，请稍后重试。'],
    ['Bad gateway. The server is temporarily unavailable.', '网关错误，服务器暂时不可用。'],
    ['Service unavailable. Please try again later.', '服务不可用，请稍后重试。'],
    ['Gateway timeout. The request took too long to process.', '网关超时，请求处理时间过长。']
  ],
  'utils/apiErrorMessages.ts': [
    ['Invalid API key. Please verify your API key and try again.', 'API 密钥无效，请核对后重试。'],
    ["The request was blocked by the provider's safety system. Please revise it and try again.", '请求被服务商的安全系统拦截，请修改后重试。']
  ],
  'app/(presentation-generator)/services/api/presentation-generation.ts': [
    ['Failed to upload documents', '上传文档失败', 'ApiResponseHandler.handleResponse'],
    ['Failed to decompose documents', '解析文档失败', 'ApiResponseHandler.handleResponse'],
    ['Failed to create presentation', '创建演示文稿失败', 'ApiResponseHandler.handleResponse'],
    ['Failed to update presentation content', '更新演示文稿内容失败', 'ApiResponseHandler.handleResponse'],
    ['Failed to update slide', '更新幻灯片失败', 'ApiResponseHandler.handleResponse'],
    ['Failed to prepare presentation', '准备演示文稿失败', 'ApiResponseHandler.handleResponse'],
    ['Failed to fetch outlines', '获取大纲失败', 'ApiResponseHandler.handleResponse'],
    ['Failed to update outlines', '更新大纲失败', 'ApiResponseHandler.handleResponse'],
    ['Failed to generate image', '生成图片失败', 'ApiResponseHandler.handleResponse'],
    ['Failed to get previous generated images', '获取已生成的图片失败', 'ApiResponseHandler.handleResponse'],
    ['Failed to search icons', '搜索图标失败', 'ApiResponseHandler.handleResponse']
  ],
  'app/(presentation-generator)/services/api/images.ts': [
    ['Failed to upload image', '上传图片失败', 'ApiResponseHandler.handleResponse'],
    ['Failed to get uploaded images', '获取已上传的图片失败', 'ApiResponseHandler.handleResponse'],
    ['Failed to get generated images', '获取已生成的图片失败', 'ApiResponseHandler.handleResponse'],
    ['Failed to generate image', '生成图片失败', 'ApiResponseHandler.handleResponse'],
    ['Failed to delete image', '删除图片失败', 'ApiResponseHandler.handleResponse'],
    ['Failed to search stock images', '搜索图库图片失败', 'ApiResponseHandler.handleResponse']
  ],
  'app/(presentation-generator)/services/api/template.ts': [
    ['Failed to get Templates summaries', '获取模板列表失败', 'ApiResponseHandler.handleResponse'],
    ['Failed to get template details', '获取模板详情失败', 'ApiResponseHandler.handleResponse']
  ],
  'app/(presentation-generator)/services/api/dashboard.ts': [
    ['Presentation not found', '未找到演示文稿', 'ApiResponseHandler.handleResponse']
  ],

  // Shared UI primitives.
  'components/ui/sonner.tsx': [
    ['Got it!', '知道了'],
    ['Dismiss notification', '关闭通知', 'closeButtonAriaLabel']
  ],
  'components/ui/overlay-loader.tsx': [
    ['Loading', '加载中', 'aria-label']
  ],
  'components/ui/dialog.tsx': [
    ['Close', '关闭']
  ],
  'components/ui/sheet.tsx': [
    ['Close', '关闭']
  ]
}
