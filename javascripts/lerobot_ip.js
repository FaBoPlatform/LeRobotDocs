(() => {
  "use strict";

  // ==========================================================
  // LeRobot Jetson IP Panel (MkDocs Material)
  // ----------------------------------------------------------
  // - <div data-lerobot-ip-panel></div> にIPアドレス入力フォームを描画
  // - ページ内のコード・リンクに含まれるデフォルトIP（192.168.55.1）を
  //   入力値でリアルタイム置換（href とリンクテキストの両方）
  // - {{JETSON_IP}} プレースホルダーにも対応
  // - 値はこのブラウザの localStorage にのみ保存
  // - lerobot_ports.js / lerobot_wifi.js とは独立して動作
  // ==========================================================

  const LS_KEY_IP = "lerobot.jetson_ip";
  const DEFAULT_IP = "192.168.55.1";

  function safeGet(key) {
    try {
      return localStorage.getItem(key) || "";
    } catch {
      return "";
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }

  function safeDel(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  function qsa(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function escapeHtmlAttr(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  // IPアドレスまたはホスト名として妥当なトークンのみ受け付ける
  function normalizeIp(s) {
    const t = String(s || "").trim();
    if (!t) return "";
    if (!/^[a-zA-Z0-9.\-]+$/.test(t)) return "";
    return t;
  }

  function collectCodeNodes(scope) {
    const blocks = qsa("pre > code", scope);
    const inline = qsa("code", scope).filter(
      (el) => !el.closest("pre") && !el.closest(".lerobot-port-panel")
    );
    return [...blocks, ...inline];
  }

  function applyIp(scope, ip) {
    const target = ip || DEFAULT_IP;

    // コードブロック・インラインコード
    for (const code of collectCodeNodes(scope)) {
      if (!code.dataset.lerobotIpTemplate) {
        const t = code.textContent || "";
        if (!t.includes(DEFAULT_IP) && !/{{\s*JETSON_IP\s*}}/.test(t)) continue;
        code.dataset.lerobotIpTemplate = t;
      }
      let out = code.dataset.lerobotIpTemplate.split(DEFAULT_IP).join(target);
      out = out.replace(/{{\s*JETSON_IP\s*}}/g, target);
      // 置換が不要なら書き換えない（シンタックスハイライト維持）
      if (code.textContent !== out) code.textContent = out;
    }

    // リンク（href とテキストの両方を置換）
    for (const a of qsa("a[href]", scope)) {
      if (!a.dataset.lerobotIpHrefTemplate) {
        const href = a.getAttribute("href") || "";
        const text = a.textContent || "";
        if (!href.includes(DEFAULT_IP) && !text.includes(DEFAULT_IP)) continue;
        a.dataset.lerobotIpHrefTemplate = href;
        a.dataset.lerobotIpTextTemplate = text;
      }
      a.setAttribute(
        "href",
        a.dataset.lerobotIpHrefTemplate.split(DEFAULT_IP).join(target)
      );
      const newText = a.dataset.lerobotIpTextTemplate
        .split(DEFAULT_IP)
        .join(target);
      if (a.textContent !== newText) a.textContent = newText;
    }
  }

  function renderPanel(panelEl, state, onChange) {
    if (panelEl.dataset.lerobotInitialized === "true") return;
    panelEl.dataset.lerobotInitialized = "true";
    panelEl.classList.add("lerobot-port-panel");

    panelEl.innerHTML = `
      <form class="lerobot-port-form" autocomplete="off">
        <div class="lerobot-port-row">
          <label class="lerobot-port-label" for="lerobot-jetson-ip">JetsonのIPアドレス</label>
          <input
            id="lerobot-jetson-ip"
            class="lerobot-port-input"
            type="text"
            inputmode="text"
            placeholder="${escapeHtmlAttr(DEFAULT_IP)}"
            value="${escapeHtmlAttr(state.ip)}"
          />
        </div>

        <div class="lerobot-port-actions">
          <button type="button" class="lerobot-port-btn" data-action="clear">初期値に戻す</button>
        </div>
      </form>
    `;

    const ipInput = panelEl.querySelector("#lerobot-jetson-ip");

    const fire = () => {
      onChange({ ip: normalizeIp(ipInput.value) });
    };

    ipInput.addEventListener("input", fire);

    panelEl.querySelector('[data-action="clear"]').addEventListener("click", () => {
      safeDel(LS_KEY_IP);
      ipInput.value = "";
      fire();
    });
  }

  function init(root = document) {
    const panel = root.querySelector("[data-lerobot-ip-panel]");

    const scope =
      (panel && (panel.closest("article") || panel.closest("main"))) ||
      root.querySelector("article") ||
      root.querySelector("main") ||
      root;

    const state = { ip: normalizeIp(safeGet(LS_KEY_IP)) };

    if (panel) {
      renderPanel(panel, state, ({ ip }) => {
        safeSet(LS_KEY_IP, ip);
        applyIp(scope, ip);
      });
    }

    // 保存値がある場合はパネルの無いページでも置換
    applyIp(scope, state.ip);
  }

  // Material for MkDocs instant loading support
  if (window.document$ && typeof window.document$.subscribe === "function") {
    window.document$.subscribe(() => init(document));
  } else {
    document.addEventListener("DOMContentLoaded", () => init(document));
  }
})();
