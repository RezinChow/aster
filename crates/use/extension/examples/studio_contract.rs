use std::io::{self, Write};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let bytes = serde_json::to_vec_pretty(&a3s_use_extension::studio_extension_point_contracts())?;
    let mut output = io::stdout().lock();
    output.write_all(&bytes)?;
    output.write_all(b"\n")?;
    Ok(())
}
