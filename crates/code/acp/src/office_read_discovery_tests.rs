use super::*;

#[tokio::test]
async fn workbook_sheet_paths_survive_bounded_output_before_cell_details() {
    let root = tempfile::tempdir().unwrap();
    let file = root.path().join("source.xlsx");
    let mut editor = NativeOfficeEditor::create(&file).await.unwrap();
    editor.rename_worksheet("/Sheet1", "First").unwrap();
    for row in 1..=120 {
        editor
            .set_cell_value(
                format!("/First/A{row}"),
                SpreadsheetCellValue::Number {
                    value: row.to_string(),
                },
            )
            .unwrap();
    }
    for name in ["Middle", "Last"] {
        editor.add_worksheet(name).unwrap();
        editor
            .set_cell_value(
                format!("/{name}/A1"),
                SpreadsheetCellValue::Number { value: "17".into() },
            )
            .unwrap();
    }
    editor.save().await.unwrap();
    let before = std::fs::read(&file).unwrap();

    let snapshot = read(root.path(), json!({"file_path":"source.xlsx"}))
        .await
        .unwrap();
    let serialized = snapshot.to_string();
    assert!(serialized.len() > 16_000);
    // A long single-line result can expose only its prefix when paged back.
    let prefix = &serialized[..2000];
    assert!(prefix.contains("/Middle"));
    assert!(prefix.contains("/Last"));
    assert_eq!(
        snapshot["document_outline"]["paths"],
        json!(["/First", "/Middle", "/Last"])
    );
    assert_eq!(snapshot["document_outline"]["total"], 3);
    assert_eq!(snapshot["document_outline"]["truncated"], false);

    let limited = read(root.path(), json!({"file_path":"source.xlsx","limit":2}))
        .await
        .unwrap();
    assert_eq!(limited["returned"], 2);
    assert_eq!(
        limited["document_outline"]["paths"],
        json!(["/First", "/Middle"])
    );
    assert_eq!(limited["document_outline"]["truncated"], true);
    let middle = read(
        root.path(),
        json!({"file_path":"source.xlsx","node_path":"/Middle/A1"}),
    )
    .await
    .unwrap();
    assert_eq!(middle["node"]["value"], 17);
    assert_eq!(std::fs::read(&file).unwrap(), before);
}
