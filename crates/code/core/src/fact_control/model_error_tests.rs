#![cfg(test)]

use super::*;

#[test]
fn typed_host_budget_denial_is_terminal_even_with_context() {
    for wrapped in [false, true] {
        let denial = crate::error::CodeError::BudgetExhausted {
            resource: "original host tokens".into(),
            reason: "host allocation exhausted".into(),
        };
        let expected = denial.to_string();
        let error = anyhow::Error::new(denial);
        let error = if wrapped {
            error.context("original model child")
        } else {
            error
        };
        assert!(matches!(model_error(error), ActorError::Defect(message) if message == expected));
    }
}

#[test]
fn identical_untyped_budget_words_remain_retryable_provider_errors() {
    let text = crate::error::CodeError::BudgetExhausted {
        resource: "original host tokens".into(),
        reason: "host allocation exhausted".into(),
    }
    .to_string();
    assert!(matches!(
        model_error(anyhow::anyhow!(text.clone())),
        ActorError::Handler { key, message } if key == "infer" && message == text
    ));
    assert!(matches!(
        model_error(crate::llm::NonRetryableLlmError::new("original provider quota").into()),
        ActorError::Defect(message) if message == "original provider quota"
    ));
}

#[derive(Clone, Copy)]
enum DetachedBehavior {
    Budget,
    Permanent,
    Recoverable,
    Eof,
    PendingStream,
    PendingFallback,
}

struct DetachedProvider {
    behavior: DetachedBehavior,
    fallback_calls: AtomicUsize,
    attempt: Mutex<Option<tokio_util::sync::CancellationToken>>,
}

#[async_trait::async_trait]
impl LlmClient for DetachedProvider {
    async fn complete(
        &self,
        _: &[Message],
        _: Option<&str>,
        _: &[ToolDefinition],
    ) -> anyhow::Result<LlmResponse> {
        self.fallback_calls.fetch_add(1, Ordering::SeqCst);
        if matches!(self.behavior, DetachedBehavior::PendingFallback) {
            return std::future::pending().await;
        }
        Ok(LlmResponse {
            message: Message::assistant("fallback answer"),
            usage: Default::default(),
            stop_reason: None,
            token_logprobs: Vec::new(),
            meta: None,
        })
    }

    async fn complete_streaming(
        &self,
        _: &[Message],
        _: Option<&str>,
        _: &[ToolDefinition],
        attempt: tokio_util::sync::CancellationToken,
    ) -> anyhow::Result<tokio::sync::mpsc::Receiver<crate::llm::StreamEvent>> {
        *self.attempt.lock().unwrap() = Some(attempt);
        match self.behavior {
            DetachedBehavior::Budget => Err(anyhow::Error::new(
                crate::error::CodeError::BudgetExhausted {
                    resource: "tokens".into(),
                    reason: "host allocation exhausted".into(),
                },
            )
            .context("detached stream setup")),
            DetachedBehavior::Permanent => {
                Err(crate::llm::NonRetryableLlmError::new("provider refused").into())
            }
            DetachedBehavior::Eof => {
                let (_, receiver) = tokio::sync::mpsc::channel(1);
                Ok(receiver)
            }
            DetachedBehavior::PendingStream => std::future::pending().await,
            DetachedBehavior::Recoverable | DetachedBehavior::PendingFallback => {
                anyhow::bail!("streaming unavailable")
            }
        }
    }
}

#[tokio::test]
async fn detached_calls_never_fallback_after_terminal_refusal_or_incomplete_stream() {
    for behavior in [
        DetachedBehavior::Budget,
        DetachedBehavior::Permanent,
        DetachedBehavior::Eof,
        DetachedBehavior::Recoverable,
    ] {
        let provider = Arc::new(DetachedProvider {
            behavior,
            fallback_calls: AtomicUsize::new(0),
            attempt: Mutex::new(None),
        });
        let result = model_call::complete_detached(
            provider.clone(),
            &[],
            None,
            &[],
            tokio_util::sync::CancellationToken::new(),
        )
        .await;
        match behavior {
            DetachedBehavior::Budget => assert!(
                matches!(result, Err(ActorError::Defect(message)) if message.contains("host allocation exhausted"))
            ),
            DetachedBehavior::Permanent => assert!(
                matches!(result, Err(ActorError::Defect(message)) if message == "provider refused")
            ),
            DetachedBehavior::Eof => assert!(
                matches!(result, Err(ActorError::Handler { message, .. }) if message == "stream ended before a response")
            ),
            DetachedBehavior::Recoverable => {
                assert_eq!(result.unwrap().text(), "fallback answer");
            }
            _ => unreachable!(),
        }
        assert_eq!(
            provider.fallback_calls.load(Ordering::SeqCst),
            usize::from(matches!(behavior, DetachedBehavior::Recoverable)),
        );
    }
}

#[tokio::test]
async fn detached_cancellation_interrupts_stream_setup_and_nonstreaming_fallback() {
    use std::future::Future;

    for behavior in [
        DetachedBehavior::PendingStream,
        DetachedBehavior::PendingFallback,
    ] {
        let provider = Arc::new(DetachedProvider {
            behavior,
            fallback_calls: AtomicUsize::new(0),
            attempt: Mutex::new(None),
        });
        let cancel = tokio_util::sync::CancellationToken::new();
        let mut call = Box::pin(model_call::complete_detached(
            provider.clone(),
            &[],
            None,
            &[],
            cancel.clone(),
        ));
        assert!(
            std::future::poll_fn(|cx| std::task::Poll::Ready(call.as_mut().poll(cx).is_pending()))
                .await
        );
        assert_eq!(
            provider.fallback_calls.load(Ordering::SeqCst),
            usize::from(matches!(behavior, DetachedBehavior::PendingFallback)),
        );
        cancel.cancel();
        let response = tokio::time::timeout(std::time::Duration::from_millis(200), call)
            .await
            .expect("host cancellation must interrupt every provider await")
            .unwrap();
        assert_eq!(response.stop_reason.as_deref(), Some("cancelled"));
    }
}

#[tokio::test]
async fn dropping_a_detached_call_cancels_only_its_provider_attempt() {
    use std::future::Future;

    let provider = Arc::new(DetachedProvider {
        behavior: DetachedBehavior::PendingStream,
        fallback_calls: AtomicUsize::new(0),
        attempt: Mutex::new(None),
    });
    let host = tokio_util::sync::CancellationToken::new();
    let mut call = Box::pin(model_call::complete_detached(
        provider.clone(),
        &[],
        None,
        &[],
        host.clone(),
    ));
    assert!(
        std::future::poll_fn(|cx| std::task::Poll::Ready(call.as_mut().poll(cx).is_pending()))
            .await
    );
    let attempt = provider.attempt.lock().unwrap().clone().unwrap();
    assert!(!attempt.is_cancelled());
    drop(call);
    assert!(attempt.is_cancelled());
    assert!(!host.is_cancelled());
}
