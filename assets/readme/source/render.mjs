import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const assets = fileURLToPath(new URL("../", import.meta.url));
const skill = resolve(process.argv[2] ?? join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "skills/hairline-create"));
const { assemble } = await import(pathToFileURL(join(skill, "build.mjs")));
const { validate } = await import(pathToFileURL(join(skill, "validate.mjs")));
const { cacheDir, playwright, launch } = await import(pathToFileURL(join(skill, "look.mjs")));
const html = assemble(readFileSync(join(assets, "source/workbench.js"), "utf8"));
assert.deepEqual(validate(html), [], "Hairline validation must pass before export");
const pagePath = join(assets, "hairline-workbench.html");
writeFileSync(pagePath, html);

const browser = await launch(playwright(cacheDir()));
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 900 }, reducedMotion: "reduce", colorScheme: "light" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    let start;
    Object.defineProperty(window, "hairline", {
      configurable: true,
      get: () => start,
      set: (value) => {
        start = (figure) => { window.workbenchTour = figure.tour; return value(figure); };
      },
    });
  });
  await page.goto(pathToFileURL(pagePath).href);
  await page.locator("#stage svg path").first().waitFor();
  const base = await page.locator("#stage svg > g > g").nth(4).innerHTML();
  const stops = await page.evaluate(() => window.workbenchTour);
  assert.equal(stops.length, 4);
  assert.equal(stops[3], null, "The tour must return to rest");
  for (const [i, expected] of ["plan", "execute", "verify"].entries()) {
    const label = await page.evaluate(([sx, sy]) => {
      const stage = document.querySelector("#stage"), bounds = stage.getBoundingClientRect();
      stage.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true, pointerType: "mouse",
        clientX: bounds.left + sx * bounds.width / 400,
        clientY: bounds.top + sy * bounds.height / 320,
      }));
      return document.querySelector("#read").textContent;
    }, stops[i]);
    assert.equal(label, expected, "The pointer must identify the selected station");
    assert.equal(await page.locator("#stage svg > g > g").nth(4).innerHTML(), base, "The kernel base must remain fixed");
  }
  await page.reload();
  await page.locator("#stage svg path").first().waitFor();
  assert.equal(await page.locator("#read").textContent(), "rest");
  await page.evaluate(() => document.getAnimations().forEach((animation) => animation.finish()));
  const drawing = await page.locator("#stage > svg").evaluate((svg) => {
    const copy = svg.cloneNode(true), originals = [svg, ...svg.querySelectorAll("*")];
    [copy, ...copy.querySelectorAll("*")].forEach((node, i) => {
      const style = getComputedStyle(originals[i]);
      for (const property of ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "fill-opacity", "stroke-opacity", "opacity"]) {
        node.setAttribute(property, style.getPropertyValue(property));
      }
      node.removeAttribute("class");
    });
    copy.setAttribute("x", "640");
    copy.setAttribute("y", "-10");
    copy.setAttribute("width", "540");
    copy.setAttribute("height", "432");
    return copy.outerHTML;
  });
  assert.deepEqual(errors, [], "The page must not report runtime errors");
  writeFileSync(join(assets, "meta-harness.svg"), `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400" role="img" aria-labelledby="title desc">
  <title id="title">Aster · Meta Harness</title>
  <desc id="desc">装配工作台的底座固定，三个工位表示任务的推演、执行与核验。Aster 以同一事实日志和执行内核组合任务行为。</desc>
  <rect width="1200" height="400" fill="#ffffff"/>
  <g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif" fill="#232327">
    <text x="64" y="68" font-size="20" letter-spacing="2" fill="#6f6f78">RUST · META HARNESS</text>
    <text x="60" y="166" font-size="88" font-weight="650" letter-spacing="-3">Aster</text>
    <text x="64" y="228" font-size="28">让任务有边界，让结果有证据。</text>
    <text x="64" y="278" font-size="24" fill="#6f6f78">同一事实日志 · 可组合组件</text>
    <text x="64" y="336" font-size="20" fill="#6f6f78">CLI + Aster Work · 源码统一维护</text>
  </g>
  ${drawing}
</svg>
`);
  console.log("Built HTML and SVG; station selection, fixed base, rest state and runtime assertions passed.");
} finally {
  await browser.close();
}
