import { informationUISurfaceFamilyForType } from "@fify/core";

/** Browser-side MCP Apps bridge plus trusted semantic DOM renderer. */
export function runInformationUIWidget(initialSequence = 0) {
  type AnyRecord = Record<string, any>;
  const content = document.querySelector<HTMLElement>("#content")!;
  const status = document.querySelector<HTMLElement>("#status")!;
  const badge = document.querySelector<HTMLElement>("#ready-badge")!;
  const expand = document.querySelector<HTMLButtonElement>("#expand")!;
  let runId = "";
  let sequence = initialSequence;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let rpcId = 1;
  let pollFailures = 0;
  let mounted = false;
  let fallbackText = "";
  let expanded = false;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: unknown) => void }>();
  const state = {
    checked: new Set<string>(),
    selected: new Set<string>(),
    inputs: new Map<string, string>(),
  };

  function post(method: string, params: unknown) {
    const id = rpcId++;
    parent.postMessage({ jsonrpc: "2.0", id, method, params }, "*");
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (pending.delete(id)) reject(new Error("bridge timeout"));
      }, 8_000);
    });
  }

  function notify(method: string, params: unknown) {
    parent.postMessage({ jsonrpc: "2.0", method, params }, "*");
  }

  function toolOutput(value: AnyRecord | null | undefined) {
    const out = value?.structuredContent ?? value;
    return out && typeof out === "object" ? out : null;
  }

  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text?: string) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function heading(node: AnyRecord, eyebrow?: string) {
    const head = element("header", "gx-section-heading");
    if (eyebrow) head.append(element("span", "gx-eyebrow", eyebrow));
    head.append(element("h2", "", String(node.title ?? "")));
    const body = String(node.text || node.value || "");
    if (body) head.append(element("p", "", body));
    return head;
  }

  function filterControl(entries: Array<{ element: HTMLElement; text: string }>) {
    const label = element("label", "gx-local-filter");
    label.append(element("span", "", "Filter this view"));
    const input = element("input");
    input.type = "search";
    input.placeholder = "Type to filter…";
    const count = element("small", "", `${entries.length} shown`);
    count.setAttribute("aria-live", "polite");
    input.oninput = () => {
      const query = input.value.trim().toLocaleLowerCase();
      let visible = 0;
      for (const entry of entries) {
        const show = !query || entry.text.includes(query);
        entry.element.hidden = !show;
        if (show) visible += 1;
      }
      count.textContent = `${visible} shown`;
      resize();
    };
    label.append(input, count);
    return label;
  }

  function renderFacts(node: AnyRecord, primary: boolean) {
    const section = element("section", `gx-surface gx-facts${primary ? " is-primary" : ""}`);
    section.append(heading(node, primary ? "Overview" : "Key facts"));
    const grid = element("dl", "gx-fact-grid");
    const entries: Array<{ element: HTMLElement; text: string }> = [];
    for (const item of node.items ?? []) {
      const row = element("div", "gx-fact");
      row.append(element("dt", "", String(item.label ?? "")));
      if (item.value) row.append(element("dd", "gx-fact-value", String(item.value)));
      if (item.detail) row.append(element("dd", "gx-fact-detail", String(item.detail)));
      grid.append(row);
      entries.push({ element: row, text: [item.label, item.value, item.detail].filter(Boolean).join(" ").toLocaleLowerCase() });
    }
    if (entries.length >= 6) section.append(filterControl(entries));
    section.append(grid);
    return section;
  }

  function renderComparison(node: AnyRecord, primary: boolean) {
    const section = element("section", `gx-surface gx-comparison${primary ? " is-primary" : ""}`);
    section.append(heading(node, "Compare"));
    const rail = element("div", "gx-comparison-rail");
    for (const item of node.items ?? []) {
      const button = element("button", "gx-option");
      button.type = "button";
      button.dataset.itemId = String(item.id);
      button.setAttribute("aria-pressed", String(state.selected.has(String(item.id))));
      if (state.selected.has(String(item.id))) button.classList.add("is-selected");
      button.append(element("span", "gx-option-label", String(item.label ?? "")));
      if (item.value) button.append(element("strong", "", String(item.value)));
      if (item.detail) button.append(element("p", "", String(item.detail)));
      const action = element("small", "", state.selected.has(String(item.id)) ? "Selected" : "Select");
      button.append(action);
      button.onclick = () => {
        for (const option of node.items ?? []) state.selected.delete(String(option.id));
        state.selected.add(String(item.id));
        rail.querySelectorAll<HTMLButtonElement>(".gx-option").forEach((option) => {
          const selected = option.dataset.itemId === String(item.id);
          option.classList.toggle("is-selected", selected);
          option.setAttribute("aria-pressed", String(selected));
          const label = option.querySelector("small");
          if (label) label.textContent = selected ? "Selected" : "Select";
        });
        persist();
      };
      rail.append(button);
    }
    section.append(rail);
    return section;
  }

  function renderChecklist(node: AnyRecord, primary: boolean) {
    const section = element("section", `gx-surface gx-checklist${primary ? " is-primary" : ""}`);
    section.append(heading(node, "Track"));
    const list = element("div", "gx-checklist-list");
    for (const item of node.items ?? []) {
      const label = element("label", "gx-check-row");
      const box = element("input");
      box.type = "checkbox";
      box.checked = state.checked.has(String(item.id));
      const control = element("span", "gx-check-control");
      control.setAttribute("aria-hidden", "true");
      const copy = element("span", "gx-check-copy");
      copy.append(element("strong", "", String(item.label ?? "")));
      if (item.detail) copy.append(element("small", "", String(item.detail)));
      if (item.value) copy.append(element("b", "", String(item.value)));
      box.onchange = () => {
        box.checked ? state.checked.add(String(item.id)) : state.checked.delete(String(item.id));
        label.classList.toggle("is-checked", box.checked);
        persist();
      };
      label.classList.toggle("is-checked", box.checked);
      label.append(box, control, copy);
      list.append(label);
    }
    section.append(list);
    return section;
  }

  function renderSteps(node: AnyRecord, primary: boolean) {
    const section = element("section", `gx-surface gx-steps${primary ? " is-primary" : ""}`);
    section.append(heading(node, "Plan"));
    const list = element("ol", "gx-step-list");
    (node.items ?? []).forEach((item: AnyRecord, index: number) => {
      const row = element("li", "gx-step");
      row.append(element("span", "gx-step-number", String(index + 1).padStart(2, "0")));
      const copy = element("div");
      if (item.value) copy.append(element("span", "gx-step-meta", String(item.value)));
      copy.append(element("strong", "", String(item.label ?? "")));
      if (item.detail) copy.append(element("p", "", String(item.detail)));
      row.append(copy);
      list.append(row);
    });
    section.append(list);
    return section;
  }

  function renderTable(node: AnyRecord, primary: boolean) {
    const section = element("section", `gx-surface gx-table${primary ? " is-primary" : ""}`);
    section.append(heading(node, "Details"));
    const table = element("div", "gx-table-rows");
    const entries: Array<{ element: HTMLElement; text: string }> = [];
    for (const item of node.items ?? []) {
      const row = element("div", "gx-table-row");
      const copy = element("div");
      copy.append(element("strong", "", String(item.label ?? "")));
      if (item.detail) copy.append(element("small", "", String(item.detail)));
      row.append(copy, element("span", "", String(item.value || "—")));
      table.append(row);
      entries.push({ element: row, text: [item.label, item.value, item.detail].filter(Boolean).join(" ").toLocaleLowerCase() });
    }
    if (entries.length >= 6) section.append(filterControl(entries));
    section.append(table);
    return section;
  }

  function renderTimeline(node: AnyRecord, primary: boolean) {
    const section = element("section", `gx-surface gx-timeline${primary ? " is-primary" : ""}`);
    section.append(heading(node, "Timeline"));
    const list = element("div", "gx-timeline-list");
    (node.items ?? []).forEach((item: AnyRecord, index: number) => {
      const row = element("article", "gx-timeline-event");
      row.append(element("time", "", String(item.value || String(index + 1).padStart(2, "0"))));
      row.append(element("i", ""));
      const copy = element("div");
      copy.append(element("strong", "", String(item.label ?? "")));
      if (item.detail) copy.append(element("p", "", String(item.detail)));
      row.append(copy);
      list.append(row);
    });
    section.append(list);
    return section;
  }

  function renderCallout(node: AnyRecord, primary: boolean) {
    const section = element("aside", `gx-surface gx-callout${primary ? " is-primary" : ""}`);
    section.append(element("span", "gx-callout-mark", "✦"));
    section.append(heading(node, "Highlight"));
    if ((node.items ?? []).length) {
      const list = element("ul");
      for (const item of node.items) list.append(element("li", "", [item.label, item.value].filter(Boolean).join(" · ")));
      section.append(list);
    }
    return section;
  }

  function renderText(node: AnyRecord, primary: boolean) {
    const section = element("section", `gx-surface gx-text${primary ? " is-primary" : ""}`);
    section.append(heading(node, primary ? "Summary" : "Context"));
    if ((node.items ?? []).length) {
      const list = element("ul", "gx-text-list");
      for (const item of node.items) {
        const row = element("li");
        row.append(element("strong", "", String(item.label ?? "")));
        if (item.detail) row.append(document.createTextNode(` — ${String(item.detail)}`));
        list.append(row);
      }
      section.append(list);
    }
    return section;
  }

  function renderInput(node: AnyRecord, primary: boolean) {
    const section = element("section", `gx-surface gx-input${primary ? " is-primary" : ""}`);
    section.append(heading(node, "Refine"));
    const field = element("label", "gx-field");
    field.append(element("span", "", String(node.label || node.title || "Input")));
    const input = element("input");
    input.type = node.meta === "number" ? "number" : "text";
    input.placeholder = String(node.value || "Type here…");
    const stateId = String(node.slot || node.id);
    input.value = state.inputs.get(stateId) ?? "";
    input.oninput = () => {
      state.inputs.set(stateId, input.value);
      persist();
    };
    field.append(input);
    section.append(field);
    return section;
  }

  function renderChoice(node: AnyRecord, primary: boolean, tabs: boolean) {
    const section = element("section", `gx-surface ${tabs ? "gx-tabs" : "gx-choice"}${primary ? " is-primary" : ""}`);
    section.append(heading(node, tabs ? "Explore" : "Choose"));
    const group = element("div", tabs ? "gx-tab-list" : "gx-choice-list");
    group.setAttribute("role", tabs ? "tablist" : "group");
    const selectedId = [...state.selected].find((id) => (node.items ?? []).some((item: AnyRecord) => String(item.id) === id)) ?? (tabs ? String(node.items?.[0]?.id ?? "") : "");
    for (const item of node.items ?? []) {
      const button = element("button", tabs ? "gx-tab" : "gx-choice-option");
      button.type = "button";
      button.dataset.itemId = String(item.id);
      const selected = selectedId === String(item.id);
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      if (tabs) button.setAttribute("role", "tab");
      button.append(element("strong", "", String(item.label ?? "")));
      if (item.value) button.append(element("span", "", String(item.value)));
      if (item.detail) button.append(element("small", "", String(item.detail)));
      button.onclick = () => {
        for (const option of node.items ?? []) state.selected.delete(String(option.id));
        state.selected.add(String(item.id));
        group.querySelectorAll<HTMLButtonElement>("button").forEach((option) => {
          const active = option.dataset.itemId === String(item.id);
          option.classList.toggle("is-selected", active);
          option.setAttribute("aria-pressed", String(active));
        });
        persist();
      };
      group.append(button);
    }
    section.append(group);
    return section;
  }

  function renderAction(node: AnyRecord) {
    const button = element("button", "gx-continuation-action");
    button.type = "button";
    button.append(element("span", "", String(node.label || node.title || "Continue")));
    button.append(element("b", "", "→"));
    button.onclick = () => sendRefinement(String(node.action?.prompt || "Refine this view using my current selections and inputs."));
    return button;
  }

  function trustedImageSrc(value: unknown) {
    try {
      const url = new URL(String(value ?? ""));
      return url.protocol === "https:" &&
        ["upload.wikimedia.org", "api.openverse.org"].includes(url.hostname.toLowerCase())
        ? url.toString()
        : "";
    } catch {
      return "";
    }
  }

  function renderMedia(node: AnyRecord) {
    const figure = element("figure", `gx-media media-${String(node.mediaRole || "illustration")}`);
    const frame = element("div", "gx-media-frame");
    const placeholder = element("div", "gx-media-placeholder");
    placeholder.append(element("span", "gx-media-placeholder-mark", "✦"));
    placeholder.append(element("strong", "", "Loading grounded visual…"));
    const src = trustedImageSrc(node.value);
    if (src) {
      const image = element("img");
      image.src = src;
      image.alt = String(node.title || "");
      image.loading = "lazy";
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";
      image.onload = () => {
        figure.classList.add("is-ready");
        placeholder.remove();
        resize();
      };
      image.onerror = () => {
        figure.classList.add("is-unavailable");
        image.remove();
        placeholder.querySelector("strong")!.textContent = "Visual unavailable";
        resize();
      };
      frame.append(image);
    } else {
      figure.classList.add("is-unavailable");
      placeholder.querySelector("strong")!.textContent = "Visual unavailable";
    }
    frame.append(placeholder);
    figure.append(frame);
    if (node.text) {
      const caption = element("figcaption");
      caption.append(element("span", "gx-eyebrow", node.mediaRole === "identity" ? "Grounded portrait" : "Grounded visual"));
      caption.append(element("p", "", String(node.text)));
      figure.append(caption);
    }
    return figure;
  }

  function renderCard(node: AnyRecord, children: HTMLElement[], primary: boolean) {
    const article = element("article", `gx-surface gx-card tone-${String(node.tone || "neutral")}${primary ? " is-primary" : ""}`);
    article.append(heading(node, node.label || "Card"));
    if (node.value) article.append(element("strong", "gx-card-value", String(node.value)));
    if (children.length) {
      const body = element("div", "gx-card-children");
      body.append(...children);
      article.append(body);
    }
    return article;
  }

  function renderHero(node: AnyRecord, children: HTMLElement[]) {
    const header = element("header", `gx-hero tone-${String(node.tone || "accent")}`);
    const copy = element("div", "gx-hero-copy");
    if (node.label) copy.append(element("span", "gx-eyebrow", String(node.label)));
    copy.append(element("h2", "", String(node.title || node.value || "")));
    if (node.text) copy.append(element("p", "", String(node.text)));
    header.append(copy);
    if (node.value) header.append(element("div", "gx-hero-mark", String(node.value)));
    if (children.length) {
      const body = element("div", "gx-hero-children");
      body.append(...children);
      header.append(body);
    }
    return header;
  }

  function safeSwatch(value: unknown) {
    const color = String(value ?? "").trim();
    return /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color) ? color : "transparent";
  }

  function renderPalette(node: AnyRecord, primary: boolean) {
    const section = element("section", `gx-surface gx-palette${primary ? " is-primary" : ""}`);
    section.append(heading(node, "Palette"));
    const list = element("ul", "gx-palette-list");
    for (const item of node.items ?? []) {
      const row = element("li");
      const swatch = element("span", "gx-swatch");
      swatch.style.backgroundColor = safeSwatch(item.value);
      swatch.setAttribute("aria-label", `${String(item.label)}: ${String(item.value)}`);
      const copy = element("div");
      copy.append(element("strong", "", String(item.label ?? "")), element("code", "", String(item.value ?? "").toUpperCase()));
      if (item.detail) copy.append(element("p", "", String(item.detail)));
      row.append(swatch, copy);
      list.append(row);
    }
    section.append(list);
    return section;
  }

  function renderBadge(node: AnyRecord) {
    const badge = element("span", `gx-badge tone-${String(node.tone || "neutral")}`);
    if (node.icon) badge.append(element("i", "", String(node.icon)));
    badge.append(document.createTextNode(String(node.label || node.value || node.title || "")));
    return badge;
  }

  function renderMetric(node: AnyRecord, primary: boolean) {
    const article = element("article", `gx-surface gx-metric${primary ? " is-primary" : ""}`);
    article.append(element("span", "gx-metric-label", String(node.label || node.title || "Metric")));
    article.append(element("strong", "gx-metric-value", String(node.value || "—")));
    if (node.text) article.append(element("p", "", String(node.text)));
    if (node.meta) article.append(element("small", "", String(node.meta)));
    return article;
  }

  function renderDataViz(node: AnyRecord, primary: boolean) {
    if (node.type === "Donut") {
      const article = element("article", `gx-surface gx-donut${primary ? " is-primary" : ""}`);
      const progress = Math.max(0, Math.min(100, Number(node.progress ?? 0)));
      const ring = element("div", "gx-donut-ring");
      ring.style.setProperty("--gx-progress", `${progress}%`);
      ring.setAttribute("role", "progressbar");
      ring.setAttribute("aria-valuemin", "0");
      ring.setAttribute("aria-valuemax", "100");
      ring.setAttribute("aria-valuenow", String(progress));
      ring.append(element("span", "", String(node.value || `${progress}%`)));
      const copy = element("div");
      copy.append(heading(node, "Progress"));
      article.append(ring, copy);
      return article;
    }
    const figure = element("figure", `gx-surface gx-chart${primary ? " is-primary" : ""}`);
    figure.append(heading(node, "Chart"));
    const plot = element("div", "gx-chart-plot");
    const max = Math.max(1, ...(node.items ?? []).map((item: AnyRecord) => Number(item.progress ?? 0)));
    for (const item of node.items ?? []) {
      const bar = element("article");
      const track = element("div", "gx-chart-bar");
      const fill = element("i");
      fill.style.height = `${Math.max(8, (Number(item.progress ?? 0) / max) * 100)}%`;
      track.append(fill);
      bar.append(track, element("strong", "", String(item.value ?? "")), element("span", "", String(item.label ?? "")));
      plot.append(bar);
    }
    figure.append(plot);
    return figure;
  }

  function renderProgress(node: AnyRecord, primary: boolean) {
    const section = element("section", `gx-surface gx-progress${primary ? " is-primary" : ""}`);
    const progress = Math.max(0, Math.min(100, Number(node.progress ?? 0)));
    const head = element("div", "gx-progress-head");
    head.append(element("span", "", String(node.label || node.title || "Progress")), element("strong", "", String(node.value || `${progress}%`)));
    const track = element("div", "gx-progress-track");
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", String(progress));
    const fill = element("i");
    fill.style.width = `${progress}%`;
    track.append(fill);
    section.append(head, track);
    if (node.title && node.title !== node.label) section.append(element("h3", "", String(node.title)));
    if (node.text) section.append(element("p", "", String(node.text)));
    return section;
  }

  function renderQuote(node: AnyRecord, primary: boolean) {
    const figure = element("figure", `gx-surface gx-quote${primary ? " is-primary" : ""}`);
    figure.append(element("blockquote", "", `“${String(node.text || node.title || "") }”`));
    if (node.label || node.meta) figure.append(element("figcaption", "", [node.label, node.meta].filter(Boolean).join(" · ")));
    return figure;
  }

  function renderMap(node: AnyRecord, primary: boolean) {
    const section = element("section", `gx-surface gx-map${primary ? " is-primary" : ""}`);
    const canvas = element("div", "gx-map-canvas");
    const route = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    route.setAttribute("viewBox", "0 0 320 170");
    route.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M-10 142 C55 115, 70 55, 128 76 S220 148, 342 24");
    route.append(path);
    canvas.append(route);
    (node.items ?? []).forEach((item: AnyRecord, index: number) => {
      const pin = element("div", "gx-map-pin");
      pin.style.left = `${12 + ((Number(item.progress ?? index * 27)) % 74)}%`;
      pin.style.top = `${20 + ((index * 31) % 55)}%`;
      pin.append(element("i", "", String(index + 1)), element("span", "", String(item.label ?? "")));
      canvas.append(pin);
    });
    section.append(canvas, heading(node, "Map"));
    return section;
  }

  function renderCalendar(node: AnyRecord, primary: boolean) {
    const section = element("section", `gx-surface gx-calendar${primary ? " is-primary" : ""}`);
    section.append(heading(node, "Schedule"));
    const flow = element("div", "gx-calendar-flow");
    (node.items ?? []).forEach((item: AnyRecord, index: number) => {
      const day = element("article", `tone-${String(item.tone || "neutral")}`);
      day.append(element("span", "", String(item.value || `D${index + 1}`)), element("strong", "", String(item.label ?? "")));
      if (item.detail) day.append(element("p", "", String(item.detail)));
      flow.append(day);
    });
    section.append(flow);
    return section;
  }

  function renderCode(node: AnyRecord) {
    const section = element("section", "gx-surface gx-code");
    const bar = element("header");
    bar.append(element("i"), element("i"), element("i"), element("span", "", String(node.label || node.meta || "Code")));
    const pre = element("pre");
    pre.append(element("code", "", String(node.text || node.value || "")));
    section.append(bar, pre);
    return section;
  }

  function renderVisual(node: AnyRecord) {
    const figure = element("figure", "gx-surface gx-visual");
    const canvas = element("div", "gx-visual-canvas");
    canvas.append(element("i"), element("i"), element("i"), element("strong", "", String(node.icon || node.value || "∞")));
    const caption = element("figcaption");
    if (node.label) caption.append(element("span", "gx-eyebrow", String(node.label)));
    if (node.title) caption.append(element("strong", "", String(node.title)));
    if (node.text) caption.append(element("p", "", String(node.text)));
    figure.append(canvas, caption);
    return figure;
  }

  function renderDivider(node: AnyRecord) {
    const divider = element("div", "gx-divider");
    divider.append(element("i"));
    if (node.label) divider.append(element("span", "", String(node.label)), element("i"));
    return divider;
  }

  function renderSurface(node: AnyRecord, index: number, children: HTMLElement[] = []) {
    const primary = node.importance === "primary" || index === 0;
    const template = informationUISurfaceFamilyForType(String(node.type));
    if (template === "card") return renderCard(node, children, primary);
    if (template === "hero") return renderHero(node, children);
    if (template === "media") return renderMedia(node);
    if (template === "facts") return renderFacts(node, primary);
    if (template === "palette") return renderPalette(node, primary);
    if (template === "badge") return renderBadge(node);
    if (template === "metric") return renderMetric(node, primary);
    if (template === "data-viz") return renderDataViz(node, primary);
    if (template === "comparison") return renderComparison(node, primary);
    if (template === "checklist") return renderChecklist(node, primary);
    if (template === "steps") return renderSteps(node, primary);
    if (template === "table") return renderTable(node, primary);
    if (template === "timeline") return renderTimeline(node, primary);
    if (template === "progress") return renderProgress(node, primary);
    if (template === "callout") return renderCallout(node, primary);
    if (template === "quote") return renderQuote(node, primary);
    if (template === "input") return renderInput(node, primary);
    if (template === "choice") return renderChoice(node, primary, false);
    if (template === "tabs") return renderChoice(node, primary, true);
    if (template === "map") return renderMap(node, primary);
    if (template === "calendar") return renderCalendar(node, primary);
    if (template === "code") return renderCode(node);
    if (template === "visual") return renderVisual(node);
    if (template === "divider") return renderDivider(node);
    if (template === "spacer") return element("div", `gx-spacer gap-${String(node.gap || "normal")}`);
    if (template === "action") return renderAction(node);
    const text = renderText(node, primary);
    if (children.length) text.append(...children);
    return text;
  }

  function renderLayout(node: AnyRecord, nodes: Map<string, AnyRecord>, path: Set<string>) {
    const childNodes = (node.children ?? []).map((id: string) => nodes.get(id)).filter(Boolean) as AnyRecord[];
    const wrapper = element("section", `gx-layout gx-${String(node.type || "Stack").toLocaleLowerCase()} gap-${String(node.gap || "normal")}`);
    if (node.type === "Grid") wrapper.style.setProperty("--gx-columns", String(Math.max(1, Math.min(4, Number(node.columns || 1)))));
    const directPrimary = childNodes.find((child) => child.importance === "primary" && informationUISurfaceFamilyForType(String(child.type)) !== "media");
    const identityMedia = childNodes.find((child) => informationUISurfaceFamilyForType(String(child.type)) === "media" && child.mediaRole === "identity");
    if (node.id === "grounded-layout" && directPrimary) {
      const primary = element("div", "gx-primary-region");
      const supporting = element("div", "gx-supporting-grid");
      const renderedPrimary = renderNode(String(directPrimary.id), nodes, 0, new Set(path));
      if (renderedPrimary) primary.append(renderedPrimary);
      if (identityMedia) {
        const renderedMedia = renderNode(String(identityMedia.id), nodes, 1, new Set(path));
        if (renderedMedia) {
          primary.classList.add("has-media");
          primary.append(renderedMedia);
        }
      }
      childNodes.filter((child) => child !== directPrimary && child !== identityMedia).forEach((child, index) => {
        const rendered = renderNode(String(child.id), nodes, index + 1, new Set(path));
        if (rendered) supporting.append(rendered);
      });
      if (primary.childElementCount) wrapper.append(primary);
      if (supporting.childElementCount) wrapper.append(supporting);
      return wrapper;
    }
    childNodes.forEach((child, index) => {
      const rendered = renderNode(String(child.id), nodes, index, new Set(path));
      if (rendered) wrapper.append(rendered);
    });
    return wrapper;
  }

  function renderNode(id: string, nodes: Map<string, AnyRecord>, index: number, path: Set<string>): HTMLElement | null {
    if (path.has(id)) return null;
    const node = nodes.get(id);
    if (!node) return null;
    path.add(id);
    if (informationUISurfaceFamilyForType(String(node.type)) === "layout") return renderLayout(node, nodes, path);
    const children = (node.children ?? []).map((childId: string, childIndex: number) => renderNode(childId, nodes, childIndex, new Set(path))).filter(Boolean) as HTMLElement[];
    return renderSurface(node, index, children);
  }

  function acceptInitial(out: AnyRecord | null) {
    if (!out?.runId || runId) return;
    runId = String(out.runId);
    fallbackText = String(out.fallbackText || "");
    sequence = 0;
    for (const frame of out.frames ?? []) acceptFrame(frame);
    if (out.state === "running" && !mounted) void poll();
    else if (out.state === "failed") showNotice("The interactive view is unavailable. The answer remains available in the conversation.");
    else if (out.state === "complete" && !mounted) showNotice("The interactive view completed without renderable frames. The answer remains available in the conversation.");
  }

  function acceptFrame(frame: AnyRecord) {
    sequence = Math.max(sequence, Number(frame.sequence || 0));
    if (frame.type === "status") status.textContent = String(frame.message || "Preparing an interactive view…");
    if (frame.type === "complete") render(frame.experience, frame.envelope);
    if (frame.type === "error") showNotice(String(frame.message || "The interactive view is unavailable."));
  }

  async function poll() {
    if (!runId || mounted) return;
    try {
      const result = await post("tools/call", { name: "read_information_ui_run", arguments: { runId, afterSequence: sequence } });
      const out = toolOutput(result as AnyRecord);
      if (!out) throw new Error("No run result");
      pollFailures = 0;
      for (const frame of out.frames ?? []) acceptFrame(frame);
      if (out.state === "running" && !mounted) timer = setTimeout(poll, 500);
      else if (out.state === "failed") showNotice("The interactive view is unavailable. The answer remains available in the conversation.");
      else if (out.state === "complete" && !mounted) showNotice("The interactive view completed without renderable frames. The answer remains available in the conversation.");
    } catch {
      pollFailures += 1;
      if (pollFailures >= 8) showNotice("The interactive view could not reconnect. The answer remains available in the conversation.");
      else timer = setTimeout(poll, 1_200);
    }
  }

  function render(exp: AnyRecord, envelope: AnyRecord) {
    mounted = true;
    if (timer) clearTimeout(timer);
    const continuation = envelope?.continuationState;
    for (const id of continuation?.checkedIds ?? []) state.checked.add(String(id));
    for (const id of continuation?.selectedIds ?? []) state.selected.add(String(id));
    for (const [id, value] of Object.entries(continuation?.inputs ?? {})) state.inputs.set(String(id), String(value));
    content.replaceChildren();
    content.className = `gx-experience topology-${String(exp.representation?.topology || "editorial-stack")}`;
    content.removeAttribute("aria-busy");
    const nodes = new Map<string, AnyRecord>((exp.nodes ?? []).map((node: AnyRecord) => [String(node.id), node]));
    const rootId = nodes.has("root") ? "root" : String((exp.nodes ?? [])[0]?.id || "");
    const root = rootId ? renderNode(rootId, nodes, 0, new Set()) : null;
    if (root) content.append(root);
    else {
      for (const [index, node] of (exp.nodes ?? []).entries()) {
        if (informationUISurfaceFamilyForType(String(node.type)) === "layout") continue;
        content.append(renderSurface(node, index));
      }
    }
    if (exp.suggestions?.length) {
      const wrap = element("nav", "gx-suggestions");
      wrap.setAttribute("aria-label", "Suggested refinements");
      wrap.append(element("span", "gx-eyebrow", "Refine this view"));
      const actions = element("div");
      for (const prompt of exp.suggestions) {
        const button = element("button", "", String(prompt));
        button.type = "button";
        button.onclick = () => sendRefinement(String(prompt));
        actions.append(button);
      }
      wrap.append(actions);
      content.append(wrap);
    }
    if (envelope?.sources?.length) {
      const details = element("details", "gx-sources");
      details.append(element("summary", "", `${envelope.sources.length} verified source${envelope.sources.length === 1 ? "" : "s"}`));
      const list = element("ul");
      for (const source of envelope.sources) {
        const item = element("li");
        const link = element("a", "", String(source.title));
        link.href = String(source.url);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        item.append(link);
        list.append(item);
      }
      details.append(list);
      content.append(details);
    }
    status.hidden = true;
    badge.textContent = "Interactive";
    badge.classList.add("is-ready");
    resize();
  }

  function persist() {
    const model = { checkedIds: [...state.checked], selectedIds: [...state.selected], inputs: Object.fromEntries(state.inputs) };
    notify("ui/notifications/model-context-changed", { structuredContent: model });
    (window as AnyRecord).openai?.setWidgetState?.(model);
  }

  function sendRefinement(prompt: string) {
    const suffix = state.checked.size || state.selected.size || state.inputs.size ? " Keep my current selections and inputs." : "";
    const host = (window as AnyRecord).openai;
    if (host?.sendFollowUpMessage) {
      host.sendFollowUpMessage({ prompt: prompt + suffix });
      return;
    }
    void post("ui/message", { role: "user", content: [{ type: "text", text: prompt + suffix }] }).catch(() => undefined);
  }

  function showNotice(text: string) {
    mounted = true;
    if (timer) clearTimeout(timer);
    content.className = "";
    const notice = element("div", "gx-notice");
    notice.append(element("strong", "", "Interactive view unavailable"), element("p", "", text));
    if (fallbackText) notice.append(element("div", "gx-fallback", fallbackText));
    content.replaceChildren(notice);
    content.removeAttribute("aria-busy");
    status.hidden = true;
    badge.textContent = "Text fallback";
    resize();
  }

  function resize() {
    requestAnimationFrame(() => notify("ui/notifications/size-changed", { height: document.documentElement.scrollHeight }));
  }

  function setExpanded(value: boolean) {
    expanded = value;
    document.body.classList.toggle("gx-expanded", expanded);
    expand.textContent = expanded ? "Collapse" : "Expand";
    expand.setAttribute("aria-label", expanded ? "Collapse interactive view" : "Expand interactive view");
    resize();
  }

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || message.jsonrpc !== "2.0") return;
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id)!;
      pending.delete(message.id);
      message.error ? request.reject(message.error) : request.resolve(message.result);
      return;
    }
    if (message.method === "ui/notifications/tool-result") acceptInitial(toolOutput(message.params));
    if (message.method === "ui/notifications/tool-input") status.textContent = "Preparing an interactive view…";
    if (message.method === "ui/notifications/host-context-changed" && message.params?.displayMode)
      setExpanded(message.params.displayMode === "fullscreen");
  });

  expand.onclick = () => {
    const host = (window as AnyRecord).openai;
    const next = !expanded;
    setExpanded(next);
    if (host?.requestDisplayMode) host.requestDisplayMode({ mode: next ? "fullscreen" : "inline" });
    else void post("ui/request-display-mode", { mode: next ? "fullscreen" : "inline" }).catch(() => undefined);
  };

  const host = (window as AnyRecord).openai;
  if (host?.toolOutput) acceptInitial(toolOutput(host.toolOutput));
  void post("ui/initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fify-information-ui", version: "1.1.0" } })
    .then(() => notify("ui/notifications/initialized", {}))
    .catch(() => undefined);
  new ResizeObserver(resize).observe(document.body);
}
