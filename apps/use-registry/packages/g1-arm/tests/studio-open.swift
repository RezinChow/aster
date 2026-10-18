// Opens the installed workbench in a running Studio window and times what a
// person sees, from the window's own pixels: press the activity-bar entry ->
// Studio leaves the plugin market (route) -> the view's panels are painted
// (its 运行实验 button) -> the first robot frame is on screen (the blue tray). Between runs it goes back to the plugin
// market. Manual: it brings Studio to the front, needs the
// Accessibility and Screen Recording permissions, and the package installed.
//
//   swiftc -O tests/studio-open.swift -o /tmp/studio-open
//   /tmp/studio-open <studio pid> <runs> [frame dir]
//
// Prints one JSON line per run. A run where Studio was not frontmost is
// marked "front": false; WebKit pauses drawing in a hidden window, so its
// times are not load times.
import AppKit
import ApplicationServices
import ScreenCaptureKit

let arguments = CommandLine.arguments
guard arguments.count >= 3, let pid = pid_t(arguments[1]), let runs = Int(arguments[2]), runs > 0 else {
  FileHandle.standardError.write("usage: studio-open <studio pid> <runs> [frame dir]\n".data(using: .utf8)!)
  exit(2)
}
let frameDir = arguments.count > 3 ? arguments[3] : nil
let entry = "宇树 G1 人形机器人"
let market = "插件"
let viewText = "仿真画面"
let limit = 30_000.0

let app = AXUIElementCreateApplication(pid)
AXUIElementSetAttributeValue(app, "AXManualAccessibility" as CFString, kCFBooleanTrue)
AXUIElementSetAttributeValue(app, "AXEnhancedUserInterface" as CFString, kCFBooleanTrue)

func attribute(_ element: AXUIElement, _ name: String) -> AnyObject? {
  var value: AnyObject?
  return AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success ? value : nil
}

struct Page { var texts = Set<String>(); var buttons: [String: AXUIElement] = [:] }

func read(_ element: AXUIElement, _ depth: Int, _ page: inout Page) {
  switch attribute(element, kAXRoleAttribute) as? String {
  case "AXStaticText":
    if let text = attribute(element, kAXValueAttribute) as? String { page.texts.insert(text) }
  case "AXButton":
    if let title = attribute(element, kAXTitleAttribute) as? String { page.buttons[title] = element }
  default: break
  }
  guard depth < 60 else { return }
  for child in attribute(element, kAXChildrenAttribute) as? [AXUIElement] ?? [] { read(child, depth + 1, &page) }
}

func page() -> Page {
  var page = Page()
  if let window = (attribute(app, kAXWindowsAttribute) as? [AXUIElement])?.first { read(window, 0, &page) }
  return page
}

func press(_ title: String) -> Bool {
  guard let button = page().buttons[title] else { return false }
  return AXUIElementPerformAction(button, kAXPressAction as CFString) == .success
}

func now() -> Double { Double(DispatchTime.now().uptimeNanoseconds) / 1e6 }
func front() -> Bool { NSWorkspace.shared.frontmostApplication?.processIdentifier == pid }
func ms(_ value: Double?) -> String { value.map { String(format: "%.0f", $0) } ?? "null" }

/// Pixels in a band of the window, as fractions of its size, that pass a colour test.
func count(_ image: CGImage, x: ClosedRange<Double>, y: ClosedRange<Double>, _ test: (Int, Int, Int) -> Bool) -> Int {
  let width = image.width, height = image.height
  var pixels = [UInt8](repeating: 0, count: width * height * 4)
  let context = CGContext(data: &pixels, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
                          space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
  var count = 0
  for row in Int(Double(height) * y.lowerBound)..<Int(Double(height) * y.upperBound) {
    for column in Int(Double(width) * x.lowerBound)..<Int(Double(width) * x.upperBound) {
      // The bitmap's first row is the image's top row.
      let i = (row * width + column) * 4
      if test(Int(pixels[i]), Int(pixels[i + 1]), Int(pixels[i + 2])) { count += 1 }
    }
  }
  return count
}

/// The scene's blue tray: the first robot frame is on screen.
func tray(_ image: CGImage) -> Int {
  count(image, x: 0.45...0.70, y: 0.50...0.72) { r, g, b in b > 140 && r < 90 && g < 130 && b - r > 80 }
}

/// The plugin market's first card cover: Studio has not left the market yet.
func market(_ image: CGImage) -> Int {
  count(image, x: 0.19...0.36, y: 0.18...0.30) { r, g, b in min(r, g, b) < 235 }
}

/// The view's black 运行实验 button: its scripts ran and its panels painted.
func panel(_ image: CGImage) -> Int {
  count(image, x: 0.27...0.33, y: 0.93...0.96) { r, g, b in r < 50 && g < 50 && b < 50 }
}

func save(_ image: CGImage, _ name: String) {
  guard let frameDir else { return }
  let data = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])
  try? data?.write(to: URL(fileURLWithPath: "\(frameDir)/\(name)"))
}

func measure() async {
  guard let content = try? await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false),
        let window = content.windows.filter({ $0.owningApplication?.processID == pid && $0.windowLayer == 0 })
          .max(by: { $0.frame.width * $0.frame.height < $1.frame.width * $1.frame.height }) else {
    print(#"{"error":"Studio window not shareable"}"#)
    return
  }
  let filter = SCContentFilter(desktopIndependentWindow: window)
  let configuration = SCStreamConfiguration()
  configuration.width = 720
  configuration.height = 460
  configuration.showsCursor = false
  let capture = { try? await SCScreenshotManager.captureImage(contentFilter: filter, configuration: configuration) }

  for run in 0..<runs {
    var away = false
    for _ in 0..<5 {
      if let image = await capture(), tray(image) == 0, !page().texts.contains(viewText) {
        away = true
        break
      }
      _ = press(market)
      try? await Task.sleep(nanoseconds: 1_500_000_000)
    }
    guard away else {
      print("{\"run\":\(run),\"error\":\"could not leave the view\"}")
      return
    }
    let start = now()
    guard press(entry) else {
      print("{\"run\":\(run),\"error\":\"activity-bar entry not found\"}")
      return
    }
    // A frame shows the state at about the time it was asked for; the next
    // frame bounds it from above.
    var left: Double?
    var painted: Double?
    var drawn: Double?
    var captures = 0
    var slowest = 0.0
    while now() - start < limit {
      let asked = now()
      guard let image = await capture() else { continue }
      captures += 1
      slowest = max(slowest, now() - asked)
      if left == nil && market(image) < 20 { left = asked - start }
      if painted == nil && panel(image) > 20 { painted = asked - start }
      if tray(image) > 40 {
        drawn = asked - start
        if painted == nil { painted = drawn }
        if run == 0 || run == runs - 1 { save(image, "studio-open-\(run).png") }
        break
      }
    }
    print("{\"run\":\(run),\"front\":\(front()),\"route_ms\":\(ms(left)),\"panel_ms\":\(ms(painted)),\"drawn_ms\":\(ms(drawn)),\"captures\":\(captures),\"slowest_capture_ms\":\(ms(slowest))}")
    fflush(stdout)
    try? await Task.sleep(nanoseconds: 800_000_000)
  }
}

let previous = NSWorkspace.shared.frontmostApplication
NSRunningApplication(processIdentifier: pid)?.activate()
if let window = (attribute(app, kAXWindowsAttribute) as? [AXUIElement])?.first {
  AXUIElementPerformAction(window, kAXRaiseAction as CFString)
}
Task {
  try? await Task.sleep(nanoseconds: 1_000_000_000)
  await measure()
  previous?.activate()
  exit(0)
}
NSApplication.shared.run()
