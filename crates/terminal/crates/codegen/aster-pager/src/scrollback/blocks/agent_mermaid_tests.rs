use super::{AgentMessageBlock, BlockContent, RenderMermaid, tests::ctx};
use crate::appearance::cache::set_render_mermaid;
use crate::scrollback::blocks::mermaid_content::{AffordanceKind, affordance_row};

fn display(block: &AgentMessageBlock, width: u16) -> Vec<String> {
    block
        .output(&ctx(width, false))
        .lines
        .into_iter()
        .map(|row| {
            row.content
                .spans
                .into_iter()
                .map(|span| span.content)
                .collect::<String>()
        })
        .collect()
}

#[test]
fn mermaid_preview_waits_for_the_fence_and_refits_the_same_message() {
    set_render_mermaid(RenderMermaid::On);
    let source = "flowchart LR\nA[开始] --> B[处理完成]\n";
    let mut block = AgentMessageBlock::streaming();
    block.push_chunk("```mermaid\n");
    block.push_chunk(source);
    let open = display(&block, 70).join("\n");
    assert!(open.contains("flowchart LR"));
    assert!(!open.contains('┌'));

    block.push_chunk("```");
    assert!(!display(&block, 70).join("\n").contains('┌'));
    block.push_chunk("\n");
    let wide = display(&block, 70);
    assert!(wide.iter().any(|line| line.contains('┌')), "{wide:?}");
    assert!(wide.iter().any(|line| line.contains("处理完成")));
    assert!(
        wide.iter()
            .all(|line| unicode_width::UnicodeWidthStr::width(line.as_str()) <= 70)
    );
    let narrow = display(&block, 12).join("\n");
    assert!(narrow.contains("flowchart"));
    assert!(!narrow.contains('┌'));
    assert_eq!(display(&block, 70), wide);

    block.finish();
    let affordances = block.diagram_affordances(&ctx(70, false));
    assert_eq!(affordances.len(), 1);
    assert_eq!(affordances[0].source, source);
    assert_eq!(
        affordance_row(false).buttons.map(|button| button.kind),
        [
            AffordanceKind::Open,
            AffordanceKind::CopyPath,
            AffordanceKind::CopySource,
        ]
    );

    set_render_mermaid(RenderMermaid::Off);
    let off = display(&block, 70).join("\n");
    assert!(off.contains("flowchart LR"));
    assert!(!off.contains('┌'));
    assert!(block.diagram_affordances(&ctx(70, false)).is_empty());
    assert_eq!(block.mermaid().source(0), Some(source));
    assert_eq!(block.copy_text(true), format!("```mermaid\n{source}```\n"));
    set_render_mermaid(RenderMermaid::Auto);
}

#[test]
fn mermaid_preview_falls_back_for_unsupported_or_over_budget_source() {
    set_render_mermaid(RenderMermaid::On);
    let oversized = format!("graph TD\nA[{}] --> B\n", "x".repeat(8_200));
    for source in [
        "sequenceDiagram\nA->>B: Hello\n",
        "flowchart TB\nA --> B\nstyle B fill:red\n",
        "flowchart TB\nA --> B[unterminated\n",
        oversized.as_str(),
    ] {
        let block = AgentMessageBlock::new(format!("```mermaid\n{source}```\n"));
        let rendered = display(&block, 70).join("\n");
        assert!(rendered.contains(source.lines().next().unwrap()));
        assert!(!rendered.contains('┌'));
        assert_eq!(block.diagram_affordances(&ctx(70, false))[0].source, source);
    }
    set_render_mermaid(RenderMermaid::Auto);
}

#[test]
fn mermaid_fallback_keeps_controls_out_of_the_drawn_spans() {
    set_render_mermaid(RenderMermaid::On);
    let source = "graph TD\nA[\u{1b}]52;c;marker\u{7}] --> B\n";
    let block = AgentMessageBlock::new(format!("```mermaid\n{source}```\n"));
    let spans = display(&block, 70);
    assert!(spans.iter().all(|line| !line.chars().any(char::is_control)));
    assert!(spans.iter().any(|line| line.contains("graph TD")));
    assert_eq!(block.mermaid().source(0), Some(source));
    set_render_mermaid(RenderMermaid::Auto);
}

#[test]
fn mermaid_quote_ending_without_a_closing_fence_stays_source() {
    set_render_mermaid(RenderMermaid::On);
    let changed = AgentMessageBlock::new("> ```mermaid\n> graph TB\n> A --> B\n\noutside\n");
    let source = display(&changed, 70).join("\n");
    assert!(source.contains("graph TB"));
    assert!(!source.contains('┌'));
    assert!(changed.mermaid().is_empty());
    set_render_mermaid(RenderMermaid::Auto);
}

#[test]
fn mermaid_off_keeps_prose_after_two_back_to_back_chunks() {
    set_render_mermaid(RenderMermaid::Off);
    let mut block = AgentMessageBlock::streaming();
    block.push_chunk("### 请求处理流程\n\n```mermaid\nflowchart LR\n  A[收到客户请求] --> B[检查输入信息]\n  B --> C[生成处理结果] --> D[返回给调用方]\n");
    block.push_chunk("```\n\n流程图已完成。\n");
    block.finish();
    let rendered = display(&block, 149);
    assert!(
        rendered.iter().any(|line| line.contains("流程图已完成。")),
        "{rendered:?}"
    );
    set_render_mermaid(RenderMermaid::Auto);
}
