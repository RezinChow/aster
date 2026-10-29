use super::*;

fn key(code: KeyCode, kind: KeyEventKind, modifiers: KeyModifiers) -> TimedInputEvent {
    TimedInputEvent::now(Event::Key(KeyEvent::new_with_kind(code, modifiers, kind)))
}

#[test]
fn native_space_releases_do_not_split_a_large_unicode_paste() {
    let text = format!(
        "中文\n{}\nEND",
        "中文 λ e\u{301} payload 0123456789 <> & \" ' / \\ ".repeat(512)
    );
    let events = text
        .chars()
        .flat_map(|character| {
            let code = if character == '\n' {
                KeyCode::Enter
            } else {
                KeyCode::Char(character)
            };
            [
                key(code, KeyEventKind::Press, KeyModifiers::NONE),
                key(code, KeyEventKind::Release, KeyModifiers::NONE),
            ]
        })
        .collect();
    let result = coalesce_live_keys(events, false, false);
    assert_eq!(
        result.len(),
        1,
        "one native paste must not become thousands of textarea edits"
    );
    assert_eq!(result[0].event, Event::Paste(text));
}

#[test]
fn ordinary_single_line_keys_keep_their_edit_semantics() {
    let text = "two words";
    let events = text
        .chars()
        .flat_map(|character| {
            [
                key(
                    KeyCode::Char(character),
                    KeyEventKind::Press,
                    KeyModifiers::NONE,
                ),
                key(
                    KeyCode::Char(character),
                    KeyEventKind::Release,
                    KeyModifiers::NONE,
                ),
            ]
        })
        .collect();
    let result = coalesce_live_keys(events, false, false);
    let chars = result
        .iter()
        .map(|event| match event.event {
            Event::Key(KeyEvent {
                code: KeyCode::Char(character),
                kind: KeyEventKind::Press,
                ..
            }) => character,
            _ => panic!("ordinary typing must remain key presses"),
        })
        .collect::<String>();
    assert_eq!(chars, text);
}

#[test]
fn owned_voice_hold_keeps_its_release() {
    let events = vec![
        key(
            KeyCode::Char(' '),
            KeyEventKind::Release,
            KeyModifiers::NONE,
        ),
        key(KeyCode::Char('a'), KeyEventKind::Press, KeyModifiers::NONE),
        key(KeyCode::Char('b'), KeyEventKind::Press, KeyModifiers::NONE),
    ];
    assert_eq!(coalesce_live_keys(events.clone(), false, true), events);
}

#[test]
fn voice_press_and_release_in_one_batch_stay_paired() {
    for (code, modifiers) in [
        (KeyCode::Char(' '), KeyModifiers::CONTROL),
        (KeyCode::F(8), KeyModifiers::NONE),
    ] {
        let events = vec![
            key(code, KeyEventKind::Press, modifiers),
            key(code, KeyEventKind::Release, KeyModifiers::NONE),
            key(KeyCode::Char('a'), KeyEventKind::Press, KeyModifiers::NONE),
        ];
        assert_eq!(coalesce_live_keys(events.clone(), false, false), events);
    }
}

#[test]
fn voice_chord_is_preserved_beside_an_actual_paste() {
    let events = vec![
        TimedInputEvent::now(Event::Paste("payload".into())),
        key(
            KeyCode::Char(' '),
            KeyEventKind::Press,
            KeyModifiers::CONTROL,
        ),
        key(
            KeyCode::Char(' '),
            KeyEventKind::Release,
            KeyModifiers::NONE,
        ),
        key(KeyCode::Char('a'), KeyEventKind::Press, KeyModifiers::NONE),
    ];
    assert_eq!(coalesce_live_keys(events.clone(), false, false), events);
}

#[test]
fn card_and_game_contexts_keep_all_original_keys() {
    let events = vec![
        key(KeyCode::Char(' '), KeyEventKind::Press, KeyModifiers::NONE),
        key(
            KeyCode::Char(' '),
            KeyEventKind::Release,
            KeyModifiers::NONE,
        ),
        key(KeyCode::Char('a'), KeyEventKind::Press, KeyModifiers::NONE),
    ];
    assert_eq!(coalesce_live_keys(events.clone(), true, false), events);
}

#[test]
fn unowned_voice_release_does_not_create_a_voice_operation() {
    let events = vec![
        key(KeyCode::F(8), KeyEventKind::Release, KeyModifiers::NONE),
        key(KeyCode::Char('a'), KeyEventKind::Press, KeyModifiers::NONE),
        key(KeyCode::Char('b'), KeyEventKind::Press, KeyModifiers::NONE),
    ];
    let expected = events[1..].to_vec();
    assert_eq!(coalesce_live_keys(events, false, false), expected);
}

#[test]
fn native_end_fence_keeps_submit_out_of_the_paste() {
    let text = "中文\ncomplete native paste";
    let mut events = text
        .chars()
        .map(|character| {
            let code = if character == '\n' {
                KeyCode::Enter
            } else {
                KeyCode::Char(character)
            };
            key(code, KeyEventKind::Press, KeyModifiers::NONE)
        })
        .collect::<Vec<_>>();
    let end = key(KeyCode::End, KeyEventKind::Press, KeyModifiers::NONE);
    let submit = key(KeyCode::Enter, KeyEventKind::Press, KeyModifiers::NONE);
    events.extend([end.clone(), submit.clone()]);
    let result = coalesce_live_keys(events, false, false);
    assert_eq!(result.len(), 3);
    assert_eq!(result[0].event, Event::Paste(text.into()));
    assert_eq!(result[1], end);
    assert_eq!(result[2], submit);
}
