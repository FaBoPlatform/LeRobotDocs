(() => {
  "use strict";

  // ==========================================================
  // LeRobot WiFi Panel (MkDocs Material)
  // ----------------------------------------------------------
  // - <div data-lerobot-wifi-panel></div> にSSID/Passwordフォームを描画
  // - コード内の {{SSID}} / {{WIFI_PASS}}（別名 {{WIFI_SSID}} / {{WIFI_PASSWORD}}）を置換
  // - 値はこのブラウザの localStorage にのみ保存（外部送信なし）
  // - lerobot_ports.js とは独立して動作（テンプレートのキャッシュキーも別）
  // ==========================================================

  const LS_KEY_SSID = "lerobot.wifi_ssid";
  const LS_KEY_PASS = "lerobot.wifi_pass";

  const KEYS_SSID = ["SSID", "WIFI_SSID"];
  const KEYS_PASS = ["WIFI_PASS", "WIFI_PASSWORD"];

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

  function collectCodeNodes(scope) {
    const blocks = qsa("pre > code", scope);
    const inline = qsa("code", scope).filter(
      (el) => !el.closest("pre") && !el.closest(".lerobot-port-panel")
    );
    return [...blocks, ...inline];
  }

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function escapeHtmlAttr(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  // {{KEY}} と {{ KEY }} の両形式を置換。値が空のキーは置換しない（プレースホルダーを残す）。
  function applyPlaceholders(text, map) {
    let out = String(text || "");
    for (const key of Object.keys(map)) {
      const val = map[key];
      if (val === undefined || val === null || String(val) === "") continue;
      const re = new RegExp(String.raw`{{\s*${escapeRegExp(key)}\s*}}`, "g");
      out = out.replace(re, String(val));
    }
    return out;
  }

  function applyToCodeNodes(codeNodes, ssid, pass) {
    const map = {};
    for (const k of KEYS_SSID) map[k] = ssid;
    for (const k of KEYS_PASS) map[k] = pass;

    for (const code of codeNodes) {
      if (!code.dataset.lerobotWifiTemplate) {
        code.dataset.lerobotWifiTemplate = code.textContent || "";
      }
      const out = applyPlaceholders(code.dataset.lerobotWifiTemplate, map);
      // 置換が不要なブロックはシンタックスハイライトを維持
      if (code.textContent !== out) code.textContent = out;
    }
  }

  function renderPanel(panelEl, state, onChange) {
    if (panelEl.dataset.lerobotInitialized === "true") return;
    panelEl.dataset.lerobotInitialized = "true";
    panelEl.classList.add("lerobot-port-panel");

    panelEl.innerHTML = `
      <form class="lerobot-port-form" autocomplete="off">
        <div class="lerobot-port-row">
          <label class="lerobot-port-label" for="lerobot-wifi-ssid">SSID</label>
          <input
            id="lerobot-wifi-ssid"
            class="lerobot-port-input"
            type="text"
            inputmode="text"
            placeholder="MyWiFi"
            value="${escapeHtmlAttr(state.ssid)}"
          />
        </div>

        <div class="lerobot-port-row">
          <label class="lerobot-port-label" for="lerobot-wifi-pass">Password</label>
          <input
            id="lerobot-wifi-pass"
            class="lerobot-port-input"
            type="password"
            placeholder="password"
            value="${escapeHtmlAttr(state.pass)}"
          />
        </div>

        <div class="lerobot-port-row">
          <label class="lerobot-port-label" for="lerobot-wifi-show">パスワードを表示</label>
          <div style="display:flex;align-items:center;gap:10px;">
            <input id="lerobot-wifi-show" type="checkbox" />
          </div>
        </div>

        <div class="lerobot-port-actions">
          <button type="button" class="lerobot-port-btn" data-action="clear">保存を消す</button>
        </div>
      </form>
    `;

    const ssidInput = panelEl.querySelector("#lerobot-wifi-ssid");
    const passInput = panelEl.querySelector("#lerobot-wifi-pass");
    const showInput = panelEl.querySelector("#lerobot-wifi-show");

    const fire = () => {
      onChange({ ssid: (ssidInput.value || "").trim(), pass: passInput.value || "" });
    };

    ssidInput.addEventListener("input", fire);
    passInput.addEventListener("input", fire);

    showInput.addEventListener("change", () => {
      passInput.type = showInput.checked ? "text" : "password";
    });

    panelEl.querySelector('[data-action="clear"]').addEventListener("click", () => {
      safeDel(LS_KEY_SSID);
      safeDel(LS_KEY_PASS);
      ssidInput.value = "";
      passInput.value = "";
      fire();
    });
  }

  function init(root = document) {
    const panel = root.querySelector("[data-lerobot-wifi-panel]");

    const scope =
      (panel && (panel.closest("article") || panel.closest("main"))) ||
      root.querySelector("article") ||
      root.querySelector("main") ||
      root;
    const codeNodes = collectCodeNodes(scope);
    if (codeNodes.length === 0) return;

    const state = {
      ssid: safeGet(LS_KEY_SSID),
      pass: safeGet(LS_KEY_PASS)
    };

    if (panel) {
      renderPanel(panel, state, ({ ssid, pass }) => {
        safeSet(LS_KEY_SSID, ssid);
        safeSet(LS_KEY_PASS, pass);
        applyToCodeNodes(codeNodes, ssid, pass);
      });
    }

    // 保存値がある場合はパネルの無いページでも置換（common.md方式と同じ挙動）
    applyToCodeNodes(codeNodes, state.ssid, state.pass);
  }

  // Material for MkDocs instant loading support
  if (window.document$ && typeof window.document$.subscribe === "function") {
    window.document$.subscribe(() => init(document));
  } else {
    document.addEventListener("DOMContentLoaded", () => init(document));
  }
})();
