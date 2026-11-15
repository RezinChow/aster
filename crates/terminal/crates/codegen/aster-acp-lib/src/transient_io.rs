//! Treat transient stdio pressure as backpressure, not a fatal transport error.
//!
//! `agent-client-protocol`'s line transport maps **any** `std::io::Error` from
//! the outgoing sink or incoming stream into a fatal `-32603 Internal error`
//! and tears the session down. On Unix, a full pipe or briefly contended fd
//! surfaces as `ErrorKind::WouldBlock` (`EAGAIN` / macOS os error 35:
//! "Resource temporarily unavailable"). That is OS backpressure, not a
//! protocol failure — the peer is alive; the write (or read) must wait and
//! retry.
//!
//! [`RetryTransientWrite`] / [`RetryTransientRead`] convert those kinds (and
//! `Interrupted`) into `Poll::Pending` with a short exponential backoff wake
//! so ACP's I/O loop never sees them as fatal errors.

use std::{
    io,
    pin::Pin,
    task::{Context, Poll},
    time::Duration,
};

use futures::{AsyncRead, AsyncWrite};
use tokio::time::{Instant, Sleep, sleep_until};

const INITIAL_BACKOFF: Duration = Duration::from_micros(50);
const MAX_BACKOFF: Duration = Duration::from_millis(16);

/// True when the error is transient OS pressure that must be retried.
#[must_use]
pub fn is_transient_io(err: &io::Error) -> bool {
    matches!(
        err.kind(),
        io::ErrorKind::WouldBlock | io::ErrorKind::Interrupted
    )
}

fn next_backoff(current: Duration) -> Duration {
    current.saturating_mul(2).min(MAX_BACKOFF)
}

/// [`AsyncWrite`] wrapper: `WouldBlock` / `Interrupted` → `Pending` + retry.
pub struct RetryTransientWrite<W> {
    inner: W,
    backoff: Duration,
    delay: Option<Pin<Box<Sleep>>>,
}

impl<W> RetryTransientWrite<W> {
    /// Wrap `inner` so transient write/flush errors become backpressure.
    pub fn new(inner: W) -> Self {
        Self {
            inner,
            backoff: INITIAL_BACKOFF,
            delay: None,
        }
    }

    /// Borrow the wrapped writer.
    pub fn get_ref(&self) -> &W {
        &self.inner
    }

    /// Borrow the wrapped writer mutably.
    pub fn get_mut(&mut self) -> &mut W {
        &mut self.inner
    }

    /// Unwrap the inner writer.
    pub fn into_inner(self) -> W {
        self.inner
    }

    fn arm_backoff(&mut self, cx: &mut Context<'_>) {
        let deadline = Instant::now() + self.backoff;
        self.backoff = next_backoff(self.backoff);
        let mut delay = Box::pin(sleep_until(deadline));
        // Register the waker for this sleep; ignore the first Pending.
        let _ = delay.as_mut().poll(cx);
        self.delay = Some(delay);
    }

    fn clear_backoff(&mut self) {
        self.backoff = INITIAL_BACKOFF;
        self.delay = None;
    }

    fn poll_backoff(&mut self, cx: &mut Context<'_>) -> Poll<()> {
        match self.delay.as_mut() {
            Some(delay) => match delay.as_mut().poll(cx) {
                Poll::Ready(()) => {
                    self.delay = None;
                    Poll::Ready(())
                }
                Poll::Pending => Poll::Pending,
            },
            None => Poll::Ready(()),
        }
    }
}

impl<W: AsyncWrite + Unpin> AsyncWrite for RetryTransientWrite<W> {
    fn poll_write(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<io::Result<usize>> {
        if self.poll_backoff(cx).is_pending() {
            return Poll::Pending;
        }
        match Pin::new(&mut self.inner).poll_write(cx, buf) {
            Poll::Ready(Err(err)) if is_transient_io(&err) => {
                self.arm_backoff(cx);
                Poll::Pending
            }
            Poll::Ready(Ok(n)) => {
                self.clear_backoff();
                Poll::Ready(Ok(n))
            }
            other => other,
        }
    }

    fn poll_flush(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        if self.poll_backoff(cx).is_pending() {
            return Poll::Pending;
        }
        match Pin::new(&mut self.inner).poll_flush(cx) {
            Poll::Ready(Err(err)) if is_transient_io(&err) => {
                self.arm_backoff(cx);
                Poll::Pending
            }
            Poll::Ready(Ok(())) => {
                self.clear_backoff();
                Poll::Ready(Ok(()))
            }
            other => other,
        }
    }

    fn poll_close(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        if self.poll_backoff(cx).is_pending() {
            return Poll::Pending;
        }
        match Pin::new(&mut self.inner).poll_close(cx) {
            Poll::Ready(Err(err)) if is_transient_io(&err) => {
                self.arm_backoff(cx);
                Poll::Pending
            }
            Poll::Ready(Ok(())) => {
                self.clear_backoff();
                Poll::Ready(Ok(()))
            }
            other => other,
        }
    }
}

/// [`AsyncRead`] wrapper: `WouldBlock` / `Interrupted` → `Pending` + retry.
pub struct RetryTransientRead<R> {
    inner: R,
    backoff: Duration,
    delay: Option<Pin<Box<Sleep>>>,
}

impl<R> RetryTransientRead<R> {
    /// Wrap `inner` so transient read errors become backpressure.
    pub fn new(inner: R) -> Self {
        Self {
            inner,
            backoff: INITIAL_BACKOFF,
            delay: None,
        }
    }

    /// Borrow the wrapped reader.
    pub fn get_ref(&self) -> &R {
        &self.inner
    }

    /// Borrow the wrapped reader mutably.
    pub fn get_mut(&mut self) -> &mut R {
        &mut self.inner
    }

    /// Unwrap the inner reader.
    pub fn into_inner(self) -> R {
        self.inner
    }

    fn arm_backoff(&mut self, cx: &mut Context<'_>) {
        let deadline = Instant::now() + self.backoff;
        self.backoff = next_backoff(self.backoff);
        let mut delay = Box::pin(sleep_until(deadline));
        let _ = delay.as_mut().poll(cx);
        self.delay = Some(delay);
    }

    fn clear_backoff(&mut self) {
        self.backoff = INITIAL_BACKOFF;
        self.delay = None;
    }

    fn poll_backoff(&mut self, cx: &mut Context<'_>) -> Poll<()> {
        match self.delay.as_mut() {
            Some(delay) => match delay.as_mut().poll(cx) {
                Poll::Ready(()) => {
                    self.delay = None;
                    Poll::Ready(())
                }
                Poll::Pending => Poll::Pending,
            },
            None => Poll::Ready(()),
        }
    }
}

impl<R: AsyncRead + Unpin> AsyncRead for RetryTransientRead<R> {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut [u8],
    ) -> Poll<io::Result<usize>> {
        if self.poll_backoff(cx).is_pending() {
            return Poll::Pending;
        }
        match Pin::new(&mut self.inner).poll_read(cx, buf) {
            Poll::Ready(Err(err)) if is_transient_io(&err) => {
                self.arm_backoff(cx);
                Poll::Pending
            }
            Poll::Ready(Ok(n)) => {
                self.clear_backoff();
                Poll::Ready(Ok(n))
            }
            other => other,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{
        future::Future,
        sync::{
            Arc,
            atomic::{AtomicUsize, Ordering},
        },
    };

    use futures::{AsyncReadExt as _, AsyncWriteExt as _};

    use super::*;

    fn run<F: Future<Output = ()>>(f: F) {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(f);
    }

    struct FlakyWrite {
        fails_left: usize,
        written: Vec<u8>,
        would_block_hits: Arc<AtomicUsize>,
    }

    impl AsyncWrite for FlakyWrite {
        fn poll_write(
            mut self: Pin<&mut Self>,
            _cx: &mut Context<'_>,
            buf: &[u8],
        ) -> Poll<io::Result<usize>> {
            if self.fails_left > 0 {
                self.fails_left -= 1;
                self.would_block_hits.fetch_add(1, Ordering::SeqCst);
                return Poll::Ready(Err(io::Error::from(io::ErrorKind::WouldBlock)));
            }
            self.written.extend_from_slice(buf);
            Poll::Ready(Ok(buf.len()))
        }

        fn poll_flush(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
            Poll::Ready(Ok(()))
        }

        fn poll_close(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
            Poll::Ready(Ok(()))
        }
    }

    struct FlakyRead {
        fails_left: usize,
        data: Vec<u8>,
        pos: usize,
        would_block_hits: Arc<AtomicUsize>,
    }

    impl AsyncRead for FlakyRead {
        fn poll_read(
            mut self: Pin<&mut Self>,
            _cx: &mut Context<'_>,
            buf: &mut [u8],
        ) -> Poll<io::Result<usize>> {
            if self.fails_left > 0 {
                self.fails_left -= 1;
                self.would_block_hits.fetch_add(1, Ordering::SeqCst);
                return Poll::Ready(Err(io::Error::from(io::ErrorKind::WouldBlock)));
            }
            let remain = self.data.len().saturating_sub(self.pos);
            if remain == 0 {
                return Poll::Ready(Ok(0));
            }
            let n = remain.min(buf.len());
            let Some(dst) = buf.get_mut(..n) else {
                return Poll::Ready(Ok(0));
            };
            let Some(src) = self.data.get(self.pos..self.pos + n) else {
                return Poll::Ready(Ok(0));
            };
            dst.copy_from_slice(src);
            self.pos += n;
            Poll::Ready(Ok(n))
        }
    }

    #[test]
    fn write_retries_would_block_instead_of_returning_error() {
        run(async {
            let hits = Arc::new(AtomicUsize::new(0));
            let flaky = FlakyWrite {
                fails_left: 3,
                written: Vec::new(),
                would_block_hits: Arc::clone(&hits),
            };
            let mut writer = RetryTransientWrite::new(flaky);
            writer
                .write_all(b"hello\n")
                .await
                .expect("write must succeed");
            writer.flush().await.expect("flush must succeed");
            assert_eq!(hits.load(Ordering::SeqCst), 3);
            assert_eq!(writer.into_inner().written, b"hello\n");
        });
    }

    #[test]
    fn write_passes_through_non_transient_errors() {
        run(async {
            struct Broken;
            impl AsyncWrite for Broken {
                fn poll_write(
                    self: Pin<&mut Self>,
                    _cx: &mut Context<'_>,
                    _buf: &[u8],
                ) -> Poll<io::Result<usize>> {
                    Poll::Ready(Err(io::Error::new(
                        io::ErrorKind::BrokenPipe,
                        "peer closed",
                    )))
                }

                fn poll_flush(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
                    Poll::Ready(Ok(()))
                }

                fn poll_close(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
                    Poll::Ready(Ok(()))
                }
            }

            let mut writer = RetryTransientWrite::new(Broken);
            let err = writer.write_all(b"x").await.expect_err("broken pipe");
            assert_eq!(err.kind(), io::ErrorKind::BrokenPipe);
        });
    }

    #[test]
    fn read_retries_would_block_instead_of_returning_error() {
        run(async {
            let hits = Arc::new(AtomicUsize::new(0));
            let flaky = FlakyRead {
                fails_left: 2,
                data: b"line\n".to_vec(),
                pos: 0,
                would_block_hits: Arc::clone(&hits),
            };
            let mut reader = RetryTransientRead::new(flaky);
            let mut buf = Vec::new();
            reader
                .read_to_end(&mut buf)
                .await
                .expect("read must succeed");
            assert_eq!(hits.load(Ordering::SeqCst), 2);
            assert_eq!(buf, b"line\n");
        });
    }

    #[test]
    fn would_block_kind_is_classified_transient() {
        let err = io::Error::from(io::ErrorKind::WouldBlock);
        assert!(is_transient_io(&err));
    }

    /// Inkstone regression: ACP logged exactly this Display string before exit.
    /// macOS only — Linux maps EAGAIN to errno 11; 35 is unrelated there.
    #[cfg(target_os = "macos")]
    #[test]
    fn macos_eagain_os_error_35_matches_observed_acp_log() {
        let err = io::Error::from_raw_os_error(35);
        assert_eq!(err.kind(), io::ErrorKind::WouldBlock);
        assert!(is_transient_io(&err));
        assert_eq!(
            err.to_string(),
            "Resource temporarily unavailable (os error 35)"
        );
    }
}
