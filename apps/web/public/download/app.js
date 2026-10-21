"use strict";

const header = document.querySelector(".site-header");
const mobileNav = document.querySelector("#mobile-nav");
const menuToggle = document.querySelector(".menu-toggle");
const dialog = document.querySelector("#download-dialog");
let downloadOpener;

function closeMenu() {
  mobileNav.hidden = true;
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "打开导航");
  header.classList.remove("menu-open");
}

const backToTop = document.querySelector(".back-to-top");
function updateScrollControls() {
  header.classList.toggle("scrolled", window.scrollY > 40);
  backToTop.hidden = window.scrollY < 600;
}
window.addEventListener("scroll", updateScrollControls, { passive: true });
updateScrollControls();
backToTop.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
  });
  document.querySelector(".brand").focus({ preventScroll: true });
});
menuToggle.addEventListener("click", () => {
  const open = mobileNav.hidden;
  mobileNav.hidden = !open;
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "关闭导航" : "打开导航");
  header.classList.toggle("menu-open", open);
});
mobileNav.addEventListener("click", (event) => {
  if (event.target.closest("a")) closeMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !mobileNav.hidden) {
    closeMenu();
    menuToggle.focus();
  }
});
window.matchMedia("(min-width: 768px)").addEventListener("change", (event) => {
  if (event.matches) closeMenu();
});

document.querySelectorAll("[data-download]").forEach((button) =>
  button.addEventListener("click", (event) => {
    event.preventDefault();
    downloadOpener = button;
    closeMenu();
    dialog.showModal();
  }),
);
document.querySelector("#close-download").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    dialog.close();
});
dialog.addEventListener("close", () => downloadOpener?.focus());

document.querySelectorAll('[role="tablist"]').forEach((tablist) => {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  function selectTab(tab) {
    tabs.forEach((item) => {
      const selected = item === tab;
      item.setAttribute("aria-selected", String(selected));
      item.tabIndex = selected ? 0 : -1;
      document.getElementById(item.getAttribute("aria-controls")).hidden = !selected;
    });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (event) => {
      const vertical = tablist.getAttribute("aria-orientation") === "vertical";
      const previous = vertical ? "ArrowUp" : "ArrowLeft";
      const next = vertical ? "ArrowDown" : "ArrowRight";
      let target;
      if (event.key === previous) target = tabs[(index + tabs.length - 1) % tabs.length];
      if (event.key === next) target = tabs[(index + 1) % tabs.length];
      if (event.key === "Home") target = tabs[0];
      if (event.key === "End") target = tabs[tabs.length - 1];
      if (target) {
        event.preventDefault();
        selectTab(target);
        target.focus();
      }
    });
  });
});

const prompt = document.querySelector("#demo-prompt");
const send = document.querySelector(".send-button");
const home = document.querySelector("#preview-home");
const result = document.querySelector("#demo-result");
const planToggle = document.querySelector(".plan-toggle");
const confirm = document.querySelector("#demo-confirm");
const demoPlan = document.querySelector(".demo-plan");
const demoProgress = document.querySelector("#demo-progress");
const demoNote = document.querySelector("#demo-note");
const workspaceShowcase = document.querySelector(".workspace-showcase");
const previewMain = document.querySelector(".preview-main");

prompt.addEventListener("input", () => {
  send.disabled = !prompt.value.trim();
});
planToggle.addEventListener("click", () =>
  planToggle.setAttribute(
    "aria-checked",
    String(planToggle.getAttribute("aria-checked") !== "true"),
  ),
);
document.querySelectorAll("[data-prompt]").forEach((button) =>
  button.addEventListener("click", () => {
    resetDemo();
    prompt.value = button.dataset.prompt;
    send.disabled = false;
    prompt.focus({ preventScroll: true });
  }),
);
function resetDemo() {
  closeOptions();
  workspaceShowcase.hidden = true;
  previewMain.classList.remove("workspace-mode");
  home.hidden = false;
  result.hidden = true;
  prompt.value = "";
  send.disabled = true;
  confirm.hidden = false;
  demoPlan.classList.remove("complete");
  demoProgress.textContent = "等待确认";
  demoNote.textContent = "计划确认后才开始执行。这是网页演示，不会访问本地文件或调用模型。";
}
document.querySelectorAll("[data-demo-reset]").forEach((button) =>
  button.addEventListener("click", () => {
    resetDemo();
    prompt.focus({ preventScroll: true });
  }),
);
document.querySelector("#demo-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!prompt.value.trim()) return;
  document.querySelector("#demo-request").textContent = prompt.value.trim();
  const planning = planToggle.getAttribute("aria-checked") === "true";
  document.querySelector("#demo-title").textContent = planning
    ? "先规划，再行动。"
    : "让执行过程清楚可见。";
  demoProgress.textContent = planning ? "等待确认" : "示例步骤";
  confirm.textContent = planning ? "确认示例计划" : "查看示例结果";
  demoNote.textContent = planning
    ? "计划确认后才开始执行。这是网页演示，不会访问本地文件或调用模型。"
    : "这是网页演示。真实任务会按你设置的权限执行，不会因为关闭规划模式而绕过确认。";
  closeOptions();
  home.hidden = true;
  result.hidden = false;
  confirm.focus({ preventScroll: true });
});
confirm.addEventListener("click", () => {
  demoPlan.classList.add("complete");
  demoProgress.textContent = "3 / 3 示例已完成";
  const review =
    document.querySelector("[data-demo-option=review]").getAttribute("aria-checked") === "true";
  const trace =
    document.querySelector("[data-demo-option=trace]").getAttribute("aria-checked") === "true";
  demoNote.textContent = `示例流程已展示。${review ? "已选择自动审查。" : ""}${trace ? "已选择产物追溯。" : ""}没有读取文件、调用模型或执行命令；真实检查需要在应用中运行。`;
  confirm.hidden = true;
  result.querySelector("[data-demo-reset]").focus({ preventScroll: true });
});

const verticalTabs = document.querySelector(".scenario-tabs");
function updateTabOrientation() {
  verticalTabs.setAttribute(
    "aria-orientation",
    window.matchMedia("(max-width: 767px)").matches ? "horizontal" : "vertical",
  );
}
updateTabOrientation();
window.matchMedia("(max-width: 767px)").addEventListener("change", updateTabOrientation);

const previewOuter = document.querySelector(".preview-outer");
const preview = document.querySelector(".app-preview");

document.querySelectorAll("[data-tour]").forEach((button) =>
  button.addEventListener("click", () => {
    closeOptions();
    home.hidden = true;
    result.hidden = true;
    workspaceShowcase.hidden = false;
    previewMain.classList.add("workspace-mode");
    const view = button.dataset.tour;
    const targetTab = document.getElementById(
      `workspace-tab-${view === "review" ? "lineage" : view}`,
    );
    targetTab.click();
    targetTab.focus({ preventScroll: true });
    if (view === "review") {
      const reviewTab = document.querySelector("#proof-tab-review");
      reviewTab.click();
      reviewTab.focus({ preventScroll: true });
    }
  }),
);
document.querySelectorAll("[data-review-action]").forEach((button) =>
  button.addEventListener("click", () => {
    document.querySelector("#review-disposition-status").textContent =
      button.dataset.reviewAction === "accepted"
        ? "示例发现已验收；这不会修改任何真实任务。"
        : "示例发现已忽略；这不会修改任何真实任务。";
  }),
);
const expandPreview = document.querySelector(".expand-preview");
function updatePreviewAccess() {
  const mobile = window.matchMedia("(max-width: 767px)").matches;
  const expanded = previewOuter.classList.contains("expanded");
  preview.inert = mobile && !expanded;
  if (mobile && !expanded) preview.setAttribute("aria-hidden", "true");
  else preview.removeAttribute("aria-hidden");
  preview.style.transform =
    mobile && expanded ? "none" : `scale(${Math.min(1, previewOuter.clientWidth / 1100)})`;
}
expandPreview.addEventListener("click", () => {
  const expanded = previewOuter.classList.toggle("expanded");
  expandPreview.setAttribute("aria-expanded", String(expanded));
  expandPreview.textContent = expanded ? "收起交互演示" : "展开交互演示";
  updatePreviewAccess();
});
window.matchMedia("(max-width: 767px)").addEventListener("change", updatePreviewAccess);
new ResizeObserver(updatePreviewAccess).observe(previewOuter);
updatePreviewAccess();

const optionsTrigger = document.querySelector(".demo-options-trigger");
const optionsMenu = document.querySelector("#demo-options");
function closeOptions() {
  optionsMenu.hidden = true;
  optionsTrigger.setAttribute("aria-expanded", "false");
}
optionsTrigger.addEventListener("click", () => {
  optionsMenu.hidden = !optionsMenu.hidden;
  optionsTrigger.setAttribute("aria-expanded", String(!optionsMenu.hidden));
});
document
  .querySelectorAll("[data-demo-option]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      button.setAttribute("aria-checked", String(button.getAttribute("aria-checked") !== "true")),
    ),
  );
document.addEventListener("pointerdown", (event) => {
  if (!optionsMenu.contains(event.target) && !optionsTrigger.contains(event.target)) closeOptions();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !optionsMenu.hidden) {
    closeOptions();
    optionsTrigger.focus({ preventScroll: true });
  }
});
