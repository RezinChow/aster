// Loads the view in WKWebView, the engine of Studio's macOS window, on the
// real GPU. Each run gets its own web view and non-persistent data store, so
// no cache is shared between runs. Driven by tests/load.proof.mjs.
//
//   swift tests/webview-load.swift <host url> <runs>
//
// Prints one JSON line per run: the view's cobot:* marks in ms from the
// frame's navigation start, or {"error": ...}.
import AppKit
import WebKit

let arguments = CommandLine.arguments
guard arguments.count == 3, let url = URL(string: arguments[1]), let runs = Int(arguments[2]), runs > 0 else {
  FileHandle.standardError.write("usage: webview-load.swift <host url> <runs>\n".data(using: .utf8)!)
  exit(2)
}

// Runs in every frame; only the view's document has the marks.
let probe = """
(() => {
  if (!location.pathname.endsWith('/ui/workbench/index.html')) return
  const report = () => {
    if (!performance.getEntriesByName('cobot:drawn').length) return setTimeout(report, 5)
    const marks = {}
    for (const mark of performance.getEntriesByType('mark')) {
      if (mark.name.startsWith('cobot:')) marks[mark.name.slice(6)] = Math.round(mark.startTime)
    }
    webkit.messageHandlers.load.postMessage(JSON.stringify(marks))
  }
  report()
})()
"""

final class Run: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
  let window: NSWindow
  var view: WKWebView?
  var timer: Timer?
  let done: (String) -> Void

  init(done: @escaping (String) -> Void) {
    self.done = done
    window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1440, height: 900), styleMask: [.titled], backing: .buffered, defer: false)
    super.init()
  }

  func start(_ url: URL) {
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .nonPersistent()
    configuration.userContentController.addUserScript(WKUserScript(source: probe, injectionTime: .atDocumentStart, forMainFrameOnly: false))
    configuration.userContentController.add(self, name: "load")
    let view = WKWebView(frame: window.contentView!.bounds, configuration: configuration)
    view.navigationDelegate = self
    window.contentView = view
    window.orderFrontRegardless()
    self.view = view
    timer = Timer.scheduledTimer(withTimeInterval: 30, repeats: false) { [weak self] _ in self?.finish(#"{"error":"timed out"}"#) }
    view.load(URLRequest(url: url))
  }

  func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
    finish(message.body as? String ?? #"{"error":"bad message"}"#)
  }

  func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
    finish(#"{"error":"web content process terminated"}"#)
  }

  func finish(_ line: String) {
    guard view != nil else { return }
    timer?.invalidate()
    view?.configuration.userContentController.removeScriptMessageHandler(forName: "load")
    view = nil
    window.orderOut(nil)
    done(line)
  }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
var remaining = runs
var current: Run?

func next() {
  guard remaining > 0 else { exit(0) }
  remaining -= 1
  current = Run { line in
    print(line)
    fflush(stdout)
    DispatchQueue.main.async(execute: next)
  }
  current?.start(url)
}

DispatchQueue.main.async(execute: next)
app.run()
