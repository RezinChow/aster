"use strict";

document.body.classList.add("enhanced");

const header = document.querySelector(".site-header");
const mobileNav = document.querySelector("#mobile-nav");
const menuToggle = document.querySelector(".menu-toggle");
const backToTop = document.querySelector(".back-to-top");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const openers = new WeakMap();
const closeTimers = new WeakMap();

function closeMenu() {
  mobileNav.hidden = true;
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "打开导航");
}
menuToggle.addEventListener("click", () => {
  const open = mobileNav.hidden;
  mobileNav.hidden = !open;
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "关闭导航" : "打开导航");
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
function updateScrollControls() {
  header.classList.toggle("scrolled", window.scrollY > 40);
  backToTop.hidden = window.scrollY < 600;
}
window.addEventListener("scroll", updateScrollControls, { passive: true });
updateScrollControls();
backToTop.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: reducedMotion.matches ? "instant" : "smooth" });
  document.querySelector(".brand").focus({ preventScroll: true });
});

function openDialog(dialog, opener) {
  window.clearTimeout(closeTimers.get(dialog));
  dialog.classList.remove("closing");
  openers.set(dialog, opener);
  closeMenu();
  dialog.showModal();
}
function closeDialog(dialog) {
  if (!dialog.open || dialog.classList.contains("closing")) return;
  if (reducedMotion.matches) {
    dialog.close();
    return;
  }
  dialog.classList.add("closing");
  closeTimers.set(
    dialog,
    window.setTimeout(() => {
      dialog.close();
      dialog.classList.remove("closing");
    }, 200),
  );
}
document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.querySelector("[data-close-dialog]").addEventListener("click", () => closeDialog(dialog));
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog(dialog);
  });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      closeDialog(dialog);
  });
  dialog.addEventListener("close", () => openers.get(dialog)?.focus({ preventScroll: true }));
});
document.querySelectorAll("[data-download]").forEach((opener) =>
  opener.addEventListener("click", (event) => {
    event.preventDefault();
    openDialog(document.querySelector("#download-dialog"), opener);
  }),
);

const screenshotLabels = {
  workspace: "Aster 工作区",
  office: "Aster Office",
  review: "Aster 自动审查",
  lineage: "Aster 产物追溯",
};
document.querySelectorAll("[data-screenshot], [data-enlarge]").forEach((opener) =>
  opener.addEventListener("click", (event) => {
    event.preventDefault();
    const key = opener.dataset.screenshot || opener.dataset.enlarge;
    if (!Object.hasOwn(screenshotLabels, key)) throw new Error("Unknown Aster screenshot");
    const image = document.querySelector("#screenshot-full");
    image.src = `./screenshots/${key}.png`;
    image.alt = `${screenshotLabels[key]}真实界面，演示数据`;
    document.querySelector("#screenshot-original").href = image.src;
    document.querySelector("#screenshot-title").textContent = `${screenshotLabels[key]}真实界面`;
    openDialog(document.querySelector("#screenshot-dialog"), opener);
  }),
);

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
  selectTab(tabs.find((tab) => tab.getAttribute("aria-selected") === "true") || tabs[0]);
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (event) => {
      let target;
      if (event.key === "ArrowLeft") target = tabs[(index + tabs.length - 1) % tabs.length];
      if (event.key === "ArrowRight") target = tabs[(index + 1) % tabs.length];
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
