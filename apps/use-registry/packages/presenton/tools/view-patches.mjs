// Behaviour edits to upstream's frontend for the view: file (relative to
// servers/nextjs) → exact-string edits. Each `find` must occur `count` times
// (default once).
export const PATCHES = {
  // fonts/ui.css declares these faces from woff2 files.
  'app/globals.css': [
    {
      find: '@font-face {\n  font-family: "Manrope";\n  font-style: normal;\n  font-weight: 200 800;\n  font-display: swap;\n  src: url("/vendor/fonts/sans_serif/manrope/Manrope[wght].ttf") format("truetype");\n}\n',
      replace: ''
    },
    {
      find: '@font-face {\n  font-family: "Syne";\n  font-style: normal;\n  font-weight: 400 800;\n  font-display: swap;\n  src: url("/vendor/fonts/sans_serif/syne/Syne[wght].ttf") format("truetype");\n}\n',
      replace: ''
    }
  ],
  // A deck and its slides live in one 64 KiB view state.
  'utils/presentationLimits.ts': [
    { find: 'export const MAX_NUMBER_OF_SLIDES = 50;', replace: 'export const MAX_NUMBER_OF_SLIDES = 20;' }
  ],
  // The font catalog points at upstream's 75 MB of TTFs; the view ships the
  // template fonts as woff2.
  'components/slide-editor/text/local-fonts.ts': [
    {
      find: 'export type LocalFontOption = {',
      replace: 'import { VIEW_LOCAL_FONT_OPTIONS, VIEW_APPLICATION_FONT_OPTIONS } from "@view/fonts";\n\nexport type LocalFontOption = {'
    },
    { find: 'export const LOCAL_FONT_OPTIONS: LocalFontOption[] = [\n', replace: 'export const LOCAL_FONT_OPTIONS: LocalFontOption[] = VIEW_LOCAL_FONT_OPTIONS;\n/* upstream catalog\n' },
    { find: '\n];\n\nconst APPLICATION_FONT_OPTIONS: LocalFontOption[] = [\n', replace: '\n*/\n\nconst APPLICATION_FONT_OPTIONS: LocalFontOption[] = VIEW_APPLICATION_FONT_OPTIONS;\n/* upstream application fonts\n' },
    { find: '\n];\n\nconst SYSTEM_FONT_FAMILY_KEYS', replace: '\n*/\n\nconst SYSTEM_FONT_FAMILY_KEYS' }
  ],
  // Upstream's API server hosts the Phosphor files; the view embeds them.
  'components/slide-editor/infographics/infographic-icons.ts': [
    { find: 'export type NormalizedInfographicIcon = {', replace: 'import { iconUrl } from "@view/backend/icons";\n\nexport type NormalizedInfographicIcon = {' },
    { find: '"/static/icons/bold/binoculars-bold.svg"', replace: 'iconUrl("binoculars")' },
    { find: '"/static/icons/bold/target-bold.svg"', replace: 'iconUrl("target")' },
    { find: '"/static/icons/bold/wrench-bold.svg"', replace: 'iconUrl("wrench")' },
    { find: '"/static/icons/bold/megaphone-bold.svg"', replace: 'iconUrl("megaphone")' },
    { find: '"/static/icons/bold/chart-line-up-bold.svg"', replace: 'iconUrl("chart-line-up")' }
  ],
  // The page header keeps the logo only: no provider settings, GitHub or
  // Discord links, and no GitHub star request.
  'app/(presentation-generator)/upload/components/GenerateHeader.tsx': [
    {
      from: '  useEffect(() => {\n    const controller = new AbortController();\n    fetch("/api/github-stars"',
      to: '  }, []);\n',
      replace: ''
    },
    { find: '<Link href="/dashboard" aria-label="Presenton dashboard"', replace: '<Link href="/upload" aria-label="演示文稿"' },
    {
      from: '        <div className="flex h-[42px] items-center gap-2 rounded-xl',
      to: '</a>\n        </div>\n',
      replace: ''
    }
  ],
  // Standard mode only (Smart mode needs upstream's HTML generator), no
  // documents (the view has no document parser), and no first-run tour.
  'app/(presentation-generator)/upload/components/UploadPage.tsx': [
    // The view is a Chinese product surface; decks default to Simplified Chinese.
    { find: '    language: LanguageType.Auto,\n', replace: '    language: LanguageType.ChineseSimplified,\n' },
    { find: '      <GenerateUserGuide mode={generationMode} communityEnabled={communityEnabled} />\n', replace: '' },
    {
      from: '          <div className="flex flex-col gap-2">\n            <button type="button" onClick={() => setModeDialogOpen(true)}',
      to: '            </div>\n          </div>\n',
      replace: '          <div />\n'
    }
  ],
  'app/(presentation-generator)/upload/components/SupportingDoc.tsx': [
    {
      from: '        <label className={`relative inline-flex h-[34px] w-[42px]',
      to: '        </label>\n',
      replace: '        <span />\n'
    }
  ],
  // Table-of-contents slides need upstream's layout matching by name.
  'app/(presentation-generator)/upload/components/AdvanceSettings.tsx': [
    {
      from: '                                <div className="flex items-center justify-between gap-3">\n                                    <label className="font-syne text-sm font-semibold leading-none text-[#1F1D2A] min-[1800px]:text-base">\n                                        Include Table of Content',
      to: '                                </div>\n',
      replace: ''
    }
  ],
  // No outline chat: the view's agent runs generation steps only. The page
  // has no dashboard; going back returns to the upload page.
  'app/(presentation-generator)/outline/components/OutlinePage.tsx': [
    { find: '  language: LanguageType.Auto,\n', replace: '  language: LanguageType.ChineseSimplified,\n' },
    { find: 'import Chat from "../../presentation/components/Chat";\n', replace: '' },
    { find: 'router.push("/dashboard")', replace: 'router.push("/upload")', count: 2 },
    { find: '          <div className="lg:mr-[369px]">\n', replace: '          <div>\n' },
    { from: '          {isOutlineAssistantVisible && (\n            <aside', to: '</aside>\n          )}\n', replace: '' },
    { find: 'lg:left-0 lg:right-[369px]', replace: 'lg:left-0 lg:right-0' }
  ],
  // The view's location is in memory, not in window.history.
  'app/(presentation-generator)/presentation/hooks/usePresentationStreaming.ts': [
    { find: 'import {', replace: 'import { dropSearchParam } from "@view/router";\nimport {', count: 'first' },
    {
      find: '              const newUrl = new URL(window.location.href);\n              newUrl.searchParams.delete("stream");\n              window.history.replaceState({}, "", newUrl.toString());\n',
      replace: '              dropSearchParam("stream");\n'
    },
    {
      find: '            const newUrl = new URL(window.location.href);\n            newUrl.searchParams.delete("stream");\n            window.history.replaceState({}, "", newUrl.toString());\n',
      replace: '            dropSearchParam("stream");\n'
    }
  ],
  // No AI chat panel and no export (both need upstream's server); the logo
  // returns to the upload page.
  'app/(presentation-generator)/presentation/components/PresentationActions.tsx': [
    { find: 'import Chat from "./Chat";\n', replace: '' },
    { find: '  activeAction: "ai",\n', replace: '  activeAction: "blocks",\n' },
    { from: '        <PrimaryActionButton\n          active={activeAction === "ai"}', to: 'onClick={() => onActionSelect("ai")}\n        />\n', replace: '' },
    {
      find: '            <div className="h-0 w-[30px] border-t border-[#EDEEEF]" />\n            <PrimaryActionButton\n              active={activeAction === "blocks"}',
      replace: '            <PrimaryActionButton\n              active={activeAction === "blocks"}'
    },
    { from: '      <div className={cn("h-full", activeAction === "ai" ? "block" : "hidden")}>', to: '      </div>\n', replace: '' },
    // Without blocks (a deck with no template) the panel falls back to texts, not the removed AI tab.
    { find: '      activeAction !== "ai"\n', replace: '      activeAction !== "texts"\n' },
    { find: 'dispatchUiState({ type: "selectAction", activeAction: "ai" });', replace: 'dispatchUiState({ type: "selectAction", activeAction: "texts" });' }
  ],
  // Option labels upstream renders from enum values, which are also what the
  // agent receives; the values stay, the labels become Chinese.
  'app/(presentation-generator)/upload/components/AdvanceSettings.tsx': [
    {
      find: '{tone}\n                                                </SelectItem>',
      replace: '{({ default: "默认", casual: "轻松", professional: "专业", funny: "幽默", educational: "教学", sales_pitch: "销售推介" } as Record<string, string>)[tone] ?? tone}\n                                                </SelectItem>'
    },
    {
      find: '{verbosity}\n                                                </SelectItem>',
      replace: '{({ concise: "简洁", standard: "标准", "text-heavy": "详尽" } as Record<string, string>)[verbosity] ?? verbosity}\n                                                </SelectItem>'
    }
  ],
  'app/(presentation-generator)/upload/components/ConfigurationSelects.tsx': [
    { find: '{value === LanguageType.Auto ? "Auto (English)" :', replace: '{value === LanguageType.Auto ? "自动（默认英语）" :' },
    { find: '                />\n                {language}\n', replace: '                />\n                {language === LanguageType.Auto ? "自动（默认英语）" : language}\n' }
  ],
  // Editor labels upstream builds from enum values or word order a pair cannot change.
  'components/slide-editor/selection/MultiSelectionToolbar.tsx': [
    { find: '{count} selected\n', replace: '已选 {count} 项\n' }
  ],
  'components/slide-editor/tables/TableToolbar.tsx': [
    {
      find: 'title={`Align ${nextAlignmentLabel(activeCellAlignment)}`}',
      replace: 'title={({ left: "左对齐", center: "居中对齐", right: "右对齐", justify: "两端对齐" } as Record<string, string>)[nextAlignmentLabel(activeCellAlignment)]}'
    }
  ],
  'components/slide-editor/shapes/ShapeToolbar.tsx': [
    { find: '                    {shape}\n                  </button>', replace: '                    {shape === "polygon" ? "多边形" : "椭圆"}\n                  </button>' },
    { find: '{mode === "none" ? "Straight" : mode}', replace: '{mode === "none" ? "Straight" : "平滑"}' }
  ],
  'components/slide-editor/layout/ContainerToolbarControls.tsx': [
    {
      find: 'aria-label={`${capitalize(point.horizontal)} ${capitalize(point.vertical)}`}',
      replace: 'aria-label={`${({ left: "左", center: "中", right: "右" } as Record<string, string>)[point.horizontal]}${({ top: "上", middle: "中", bottom: "下" } as Record<string, string>)[point.vertical]}`}'
    }
  ],
  // Chinese defaults that no view-zh pair can reach: bare array elements whose
  // English also appears in other bundled files (where it must stay English).
  'components/slide-editor/insert/insert-elements.ts': [
    { find: 'categories: ["Critical", "High", "Medium", "Low"],', replace: 'categories: ["紧急", "高", "中", "低"],' },
    { find: '["Foundation", "Establish', replace: '["基础", "Establish' },
    { find: '["Initial", "Capabilities', replace: '["初始级", "Capabilities' },
    { find: '["Customer", "Strengthen', replace: '["客户", "Strengthen' },
    { find: '["Growth", "Expand market', replace: '["增长", "Expand market' },
    { find: '["Innovation", "Leverage', replace: '["创新", "Leverage' },
    { find: 'items: ["Strategy", "Customer", "People", "Process", "Technology", "Data"]', replace: 'items: ["战略", "客户", "People", "流程", "Technology", "Data"]' },
    { find: '["Strategy", "Defines', replace: '["战略", "Defines' },
    { find: '["Customer", "Focuses', replace: '["客户", "Focuses' },
    { find: '["Process", "Improves', replace: '["流程", "Improves' },
    { find: '["Identify", "Detect', replace: '["识别", "Detect' },
    { find: '["Prioritize", "Rank', replace: '["排序", "Rank' },
    { find: '["Assess", "Evaluate', replace: '["评估", "Evaluate' },
    { find: '["Respond", "Define mitigation', replace: '["应对", "Define mitigation' },
    { find: 'values: ["Moderate", "Low", "Slow", "High", "High"]', replace: 'values: ["中等", "低", "慢", "高", "高"]', count: 3 },
    { find: 'values: ["High", "Low", "Fast", "Low", "High"]', replace: 'values: ["高", "低", "快", "低", "高"]' },
    { find: 'values: ["Low", "Low", "Slow", "Fast", "High"]', replace: 'values: ["低", "低", "慢", "快", "高"]' }
  ],
  'components/slide-editor/infographics/infographic-editing.ts': [
    { find: 'heading: `${index % 2 === 0 ? "Before" : "After"} ${pair}`,', replace: 'heading: `${index % 2 === 0 ? "改进前" : "改进后"} ${pair}`,' }
  ],
  'components/slide-editor/infographics/InfographicEditorContent.tsx': [
    { find: '? ` · ${itemCount} ${itemCount === 1 ? "item" : "items"}`', replace: '? ` · ${itemCount} 个条目`' },
    { find: '{itemCount} {itemCount === 1 ? "item" : "items"}', replace: '{itemCount} 个条目' },
    { find: '{pair[0].heading || "Before"} → {pair[1].heading || "After"}', replace: '{pair[0].heading || "改进前"} → {pair[1].heading || "改进后"}' },
    { find: '? data.before_label ?? "Before"\n                        : data.after_label ?? "After";', replace: '? data.before_label ?? "改进前"\n                        : data.after_label ?? "改进后";' },
    { find: '["Identify", "Prioritize", "Assess", "Respond"].map(', replace: '["识别", "排序", "评估", "应对"].map(' }
  ],
  // Chinese has no plural; a view-zh pair cannot drop the suffix substitution.
  'app/(presentation-generator)/presentation/components/NewSlide.tsx': [
    { find: '`${selectableLayouts.length} Option${selectableLayouts.length === 1 ? "" : "s"}`', replace: '`${selectableLayouts.length} 个选项`' }
  ],
  'app/(presentation-generator)/presentation/page.tsx': [
    { find: 'router.push("/dashboard")', replace: 'router.push("/upload")' }
  ],
  // A new slide's prompt box hands its prompt to the AI chat, which the view
  // does not have.
  'app/(presentation-generator)/presentation/components/PresentationPage.tsx': [
    { from: '                  showBlankPromptOverlay={\n', to: '                  }\n', replace: '                  showBlankPromptOverlay={false}\n' },
    { from: '                  showTemplatePromptOverlay={\n', to: '                  }\n', replace: '                  showTemplatePromptOverlay={false}\n' }
  ],
  'app/(presentation-generator)/presentation/components/PresentationHeader.tsx': [
    { find: 'router.push("/dashboard");', replace: 'router.push("/upload");' },
    { from: '          <Popover open={open} onOpenChange={setOpen}>', to: '          </Popover>\n', replace: '' }
  ],
  // Custom templates need upstream's template builder.
  'app/(presentation-generator)/outline/components/TemplateSelection.tsx': [
    {
      find: '              {!presentonCloudOnly && (\n                <CreateCustomTemplate\n                  selectionPage\n                  onClick={onCreateTemplate}\n                />\n              )}\n',
      replace: ''
    }
  ]
}
