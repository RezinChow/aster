//! Streaming SSE translation bodies for cross-protocol attempts.
//!
//! Each wrapper sits innermost over the upstream SSE body, scans complete
//! `data:` lines (the `event:` name lines ride alongside and are redundant
//! for translation), feeds the matching stream machine, and re-frames the
//! translated output. Downstream observers (admission reconciliation,
//! usage lifecycle, metrics) see frames in the endpoint dialect.

use crate::response_body::ResponseBody;
use crate::translation::{
    AnthropicToOpenaiStream, ChatToResponsesStream, OpenaiToAnthropicStream, TranslationError,
};
use bytes::Bytes;
use hyper::body::{Body, Frame, SizeHint};
use serde_json::Value;
use std::pin::Pin;
use std::task::{Context, Poll};

/// Bound for an incomplete SSE line carried between frames; event payloads
/// fit in a few hundred bytes, mirroring the usage observer's line bound.
const MAX_LINE_CARRY_BYTES: usize = 8 * 1024;

/// The two stream machines behind one scanner.
// The `To*` prefix is the point: each variant names the dialect the
// stream is translated into.
#[allow(clippy::enum_variant_names)]
enum StreamMachine {
    ToOpenai(AnthropicToOpenaiStream),
    ToAnthropic(OpenaiToAnthropicStream),
    ToResponses(ChatToResponsesStream),
}

impl StreamMachine {
    fn push(&mut self, event: &Value) -> Result<Vec<Value>, TranslationError> {
        match self {
            Self::ToOpenai(machine) => machine.push(event),
            Self::ToAnthropic(machine) => machine.push(event),
            Self::ToResponses(machine) => machine.push(event),
        }
    }

    /// Frame one translated event as SSE bytes. The Anthropic direction
    /// prefixes the `event:` name line, matching its wire convention.
    fn frame(event: &Value) -> Option<Bytes> {
        if event.is_string() {
            let sentinel = event.as_str().unwrap_or("[DONE]");
            return Some(Bytes::from(format!("data: {sentinel}\n\n")));
        }
        let encoded = serde_json::to_vec(event).ok()?;
        let payload = String::from_utf8_lossy(&encoded);
        if let Some(event_type) = event.get("type").and_then(Value::as_str) {
            Some(Bytes::from(format!(
                "event: {event_type}\ndata: {payload}\n\n"
            )))
        } else {
            Some(Bytes::from(format!("data: {payload}\n\n")))
        }
    }
}

pub(crate) struct TranslatedStreamBody {
    inner: Pin<Box<ResponseBody>>,
    machine: StreamMachine,
    line_carry: Vec<u8>,
    skip_until_newline: bool,
    pending: std::collections::VecDeque<Bytes>,
    upstream_ended: bool,
}

impl TranslatedStreamBody {
    pub(crate) fn to_openai(inner: ResponseBody, created_unix: i64) -> Self {
        Self::with_machine(
            inner,
            StreamMachine::ToOpenai(AnthropicToOpenaiStream::new(created_unix)),
        )
    }

    pub(crate) fn to_anthropic(inner: ResponseBody) -> Self {
        Self::with_machine(
            inner,
            StreamMachine::ToAnthropic(OpenaiToAnthropicStream::new()),
        )
    }

    pub(crate) fn to_responses(inner: ResponseBody) -> Self {
        Self::with_machine(
            inner,
            StreamMachine::ToResponses(ChatToResponsesStream::new()),
        )
    }

    fn with_machine(inner: ResponseBody, machine: StreamMachine) -> Self {
        Self {
            inner: Box::pin(inner),
            machine,
            line_carry: Vec::new(),
            skip_until_newline: false,
            pending: std::collections::VecDeque::new(),
            upstream_ended: false,
        }
    }

    fn note_bytes(&mut self, bytes: &[u8]) {
        if self.skip_until_newline {
            let Some(newline) = bytes.iter().position(|&b| b == b'\n') else {
                return;
            };
            self.skip_until_newline = false;
            self.note_bytes(&bytes[newline + 1..]);
            return;
        }
        self.line_carry.extend_from_slice(bytes);
        while let Some(newline) = self.line_carry.iter().position(|&b| b == b'\n') {
            let mut line = self.line_carry.drain(..=newline).collect::<Vec<u8>>();
            if line.last() == Some(&b'\n') {
                line.pop();
            }
            if line.last() == Some(&b'\r') {
                line.pop();
            }
            if let Ok(text) = std::str::from_utf8(&line) {
                self.note_line(text.trim_end_matches(['\r', '\n']));
            }
        }
        if self.line_carry.len() > MAX_LINE_CARRY_BYTES {
            self.line_carry.clear();
            self.skip_until_newline = true;
        }
    }

    fn note_line(&mut self, line: &str) {
        let Some(data) = line.strip_prefix("data:") else {
            // `event:` name lines and comments ride alongside; translation
            // keys off the data payload only.
            return;
        };
        let data = data.trim();
        if data.is_empty() {
            return;
        }
        let Ok(event) = serde_json::from_str::<Value>(data) else {
            return;
        };
        match self.machine.push(&event) {
            Ok(frames) => {
                for frame in frames {
                    if let Some(bytes) = StreamMachine::frame(&frame) {
                        self.pending.push_back(bytes);
                    }
                }
            }
            Err(TranslationError(reason)) => {
                tracing::warn!(reason, "Streaming translation refused an event");
            }
        }
    }
}

impl Body for TranslatedStreamBody {
    type Data = Bytes;
    type Error = std::io::Error;

    fn poll_frame(
        self: Pin<&mut Self>,
        context: &mut Context<'_>,
    ) -> Poll<Option<Result<Frame<Self::Data>, Self::Error>>> {
        let this = self.get_mut();
        loop {
            if let Some(frame) = this.pending.pop_front() {
                return Poll::Ready(Some(Ok(Frame::data(frame))));
            }
            if this.upstream_ended {
                return Poll::Ready(None);
            }
            match this.inner.as_mut().poll_frame(context) {
                Poll::Ready(Some(Ok(frame))) => {
                    if let Some(data) = frame.data_ref() {
                        this.note_bytes(data);
                    }
                    if this.inner.is_end_stream() {
                        this.upstream_ended = true;
                    }
                }
                Poll::Ready(Some(Err(error))) => {
                    this.upstream_ended = true;
                    return Poll::Ready(Some(Err(error)));
                }
                Poll::Ready(None) => {
                    this.upstream_ended = true;
                }
                Poll::Pending => return Poll::Pending,
            }
        }
    }

    fn is_end_stream(&self) -> bool {
        self.pending.is_empty() && self.upstream_ended && self.inner.is_end_stream()
    }

    fn size_hint(&self) -> SizeHint {
        self.inner.size_hint()
    }
}
