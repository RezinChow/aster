#[derive(Default)]
pub(super) struct Decoder(Vec<u8>);

impl Decoder {
    pub(super) fn push(&mut self, bytes: &[u8], eof: bool) -> String {
        self.0.extend_from_slice(bytes);
        let mut output = String::new();
        loop {
            match std::str::from_utf8(&self.0) {
                Ok(text) => {
                    output.push_str(text);
                    self.0.clear();
                    break;
                }
                Err(error) => {
                    let valid = error.valid_up_to();
                    output.push_str(&String::from_utf8_lossy(&self.0[..valid]));
                    self.0.drain(..valid);
                    match error.error_len() {
                        Some(length) => {
                            output.push('\u{fffd}');
                            self.0.drain(..length);
                        }
                        None => {
                            if eof {
                                output.push_str(&String::from_utf8_lossy(&self.0));
                                self.0.clear();
                            }
                            break;
                        }
                    }
                }
            }
        }
        output
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn split_utf8_and_invalid_bytes_do_not_lose_or_duplicate_output() {
        let mut decoder = super::Decoder::default();
        let bytes = "中文🌟".as_bytes();
        let mut output = String::new();
        for byte in bytes {
            output.push_str(&decoder.push(&[*byte], false));
        }
        output.push_str(&decoder.push(&[], true));
        assert_eq!(output, "中文🌟");
        assert_eq!(decoder.push(&[0xff, b'x', 0xe4], true), "\u{fffd}x\u{fffd}");
    }
}
