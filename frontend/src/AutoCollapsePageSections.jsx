import { useEffect } from "react";

const NEVER_COLLAPSE_TABS = new Set([
  "Inventory Orders",
  "Inventory Stock",
  "Inventory Low Stock",
  "Inventory History",
  "Invoices"
]);

const HEADING_SELECTOR = "h2, h3, h4, h5, .section-title, .card-title, .settings-section-title";

function getLevel(element) {
  const tag = String(element?.tagName || "H3").toUpperCase();
  if (/^H[1-6]$/.test(tag)) return Number(tag.replace("H", ""));
  return element?.classList?.contains("section-title") ? 3 : 4;
}

function isInsideBlockedArea(element) {
  return Boolean(
    element.closest(
      ".top-bar, .sidebar, .dashboard-sidebar, .nav-sidebar, table, thead, tbody, .no-auto-collapse, [data-no-auto-collapse='true']"
    )
  );
}

function isUsableHeading(heading, card) {
  if (!heading || !card.contains(heading) || isInsideBlockedArea(heading)) return false;
  const text = (heading.textContent || "").trim();
  if (!text || text.length < 2 || text.length > 90) return false;
  const rect = heading.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function closestTopLevelBlock(node, boundary) {
  let current = node;
  while (current?.parentElement && current.parentElement !== boundary) {
    current = current.parentElement;
  }
  return current || node;
}

function findContentNodes(heading, card) {
  const level = getLevel(heading);
  const parent = heading.parentElement;
  if (!parent) return [];

  const siblingNodes = [];
  let current = heading.nextElementSibling;
  while (current) {
    const isHeading = current.matches?.(HEADING_SELECTOR);
    if (isHeading && getLevel(current) <= level) break;
    if (!isInsideBlockedArea(current)) siblingNodes.push(current);
    current = current.nextElementSibling;
  }

  if (siblingNodes.length) return siblingNodes;

  // Many pages put a heading inside a card header and the fields/buttons inside the same card.
  // In that case, collapse everything in the containing card except the heading/header itself.
  const block = closestTopLevelBlock(heading, card);
  if (!block || block === heading || block === card) return [];
  return Array.from(block.children).filter((child) => child !== heading && !child.contains(heading) && !isInsideBlockedArea(child));
}

function AutoCollapsePageSections({ activeTab }) {
  useEffect(() => {
    if (!activeTab || NEVER_COLLAPSE_TABS.has(activeTab)) return undefined;

    let cleanups = [];
    let frame = null;
    let observer = null;

    function clearPrevious() {
      cleanups.forEach((cleanup) => cleanup());
      cleanups = [];

      document.querySelectorAll("[data-auto-section-heading='true']").forEach((heading) => {
        heading.removeAttribute("data-auto-section-heading");
        heading.removeAttribute("data-auto-section-collapsed");
        heading.removeAttribute("role");
        heading.removeAttribute("tabindex");
        heading.classList.remove("auto-section-heading");
      });

      document.querySelectorAll("[data-auto-section-node='true']").forEach((node) => {
        node.removeAttribute("data-auto-section-node");
        node.style.display = node.dataset.originalDisplay || "";
        delete node.dataset.originalDisplay;
      });
    }

    function apply() {
      const card = document.querySelector(".content-card");
      if (!card) return;
      clearPrevious();

      const allHeadings = Array.from(card.querySelectorAll(HEADING_SELECTOR)).filter((heading) =>
        isUsableHeading(heading, card)
      );

      allHeadings.forEach((heading) => {
        const nodes = findContentNodes(heading, card).filter((node) => node && node !== heading);
        if (!nodes.length) return;

        heading.dataset.autoSectionHeading = "true";
        heading.dataset.autoSectionCollapsed = "false";
        heading.classList.add("auto-section-heading");
        heading.setAttribute("role", "button");
        heading.setAttribute("tabindex", "0");

        nodes.forEach((node) => {
          node.dataset.autoSectionNode = "true";
          node.dataset.originalDisplay = node.style.display || "";
        });

        function setCollapsed(collapsed) {
          heading.dataset.autoSectionCollapsed = collapsed ? "true" : "false";
          nodes.forEach((node) => {
            node.style.display = collapsed ? "none" : node.dataset.originalDisplay || "";
          });
        }

        function toggle(event) {
          event?.stopPropagation?.();
          setCollapsed(heading.dataset.autoSectionCollapsed !== "true");
        }

        function onKeyDown(event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle(event);
          }
        }

        heading.addEventListener("click", toggle);
        heading.addEventListener("keydown", onKeyDown);
        cleanups.push(() => {
          heading.removeEventListener("click", toggle);
          heading.removeEventListener("keydown", onKeyDown);
        });
      });
    }

    function scheduleApply() {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    }

    scheduleApply();
    const card = document.querySelector(".content-card");
    if (card) {
      observer = new MutationObserver(() => scheduleApply());
      observer.observe(card, { childList: true, subtree: true });
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (observer) observer.disconnect();
      clearPrevious();
    };
  }, [activeTab]);

  return null;
}

export default AutoCollapsePageSections;
