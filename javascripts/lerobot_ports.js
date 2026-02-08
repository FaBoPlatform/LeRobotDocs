(() => {
  "use strict";

  // ==========================================================
  // LeRobot Port / Path Panel (MkDocs Material)
  // ----------------------------------------------------------
  // This version implements the user's latest path rules:
  // - dataset.repo_id: <user>/<id> (e.g. local/1cam_test)
  // - project dir: <workspace>/lerobot (e.g. /home/jetson/lerobot)
  // - dataset.root (actual dataset dir): <project>/<repo_id>
  //   (e.g. /home/jetson/lerobot/local/1cam_test)
  // - models: <project>/models/<policy>_<dataset_slug>
  // ----------------------------------------------------------
  // UI requirements:
  // - Provide a "push to hub" toggle (dataset.push_to_hub)
  // - Do NOT show eval dataset row
  // - Do NOT show long hint/comment
  // ==========================================================

  // ---------- LocalStorage keys ----------
  const LS_KEY_TELEOP = "lerobot.teleop_port";
  const LS_KEY_ROBOT = "lerobot.robot_port";
  const LS_KEY_WORKSPACE = "lerobot.workspace_dir";
  const LS_KEY_DATASET_REPO = "lerobot.dataset_repo_id";
  const LS_KEY_PUSH_TO_HUB = "lerobot.dataset_push_to_hub";

  // Backward-compatibility (older versions stored this)
  const LS_KEY_LEGACY_DATASET_ROOT = "lerobot.dataset_root";

  // ---------- Replace targets (support "=value" and " value") ----------
  const RE_TELEOP_EQ = /(--teleop\.port=)(\S+)/g;
  const RE_TELEOP_SP = /(--teleop\.port\s+)(\S+)/g;
  const RE_ROBOT_EQ = /(--robot\.port=)(\S+)/g;
  const RE_ROBOT_SP = /(--robot\.port\s+)(\S+)/g;

  const RE_DSET_ROOT_EQ = /(--dataset\.root=)(\S+)/g;
  const RE_DSET_ROOT_SP = /(--dataset\.root\s+)(\S+)/g;
  const RE_DSET_REPO_EQ = /(--dataset\.repo_id=)(\S+)/g;
  const RE_DSET_REPO_SP = /(--dataset\.repo_id\s+)(\S+)/g;

  // LeRobot record upload toggle
  const RE_PUSH_EQ = /(--dataset\.push_to_hub=)(\S+)/g;
  const RE_PUSH_SP = /(--dataset\.push_to_hub\s+)(\S+)/g;

  // Hydra style (train) in configs
  const RE_DATASET_PATH_EQ = /(dataset\.path=)(\S+)/g;
  const RE_DATASET_PATH_SP = /(dataset\.path\s+)(\S+)/g;

  // Train / resume / inference paths
  const RE_OUTPUT_DIR_EQ = /(--output_dir=)(\S+)/g;
  const RE_OUTPUT_DIR_SP = /(--output_dir\s+)(\S+)/g;
  const RE_JOB_NAME_EQ = /(--job_name=)(\S+)/g;
  const RE_JOB_NAME_SP = /(--job_name\s+)(\S+)/g;
  const RE_CONFIG_PATH_EQ = /(--config_path=)(\S+)/g;
  const RE_CONFIG_PATH_SP = /(--config_path\s+)(\S+)/g;
  const RE_POLICY_PATH_EQ = /(--policy\.path=)(\S+)/g;
  const RE_POLICY_PATH_SP = /(--policy\.path\s+)(\S+)/g;

  // Optional: rm -rf <path>
  const RE_RM_RF = /(rm\s+-rf\s+)(\S+)/g;

  // Optional: cd <path> (single line)
  const RE_CD_LINE = /^(\s*cd\s+)(\S+)(\s*)$/gm;

  // Optional: mkdir -p <path> (single line)
  const RE_MKDIR_P = /^(\s*mkdir\s+-p\s+)(\S+)(\s*)$/gm;

  // For guessing defaults from the document
  const RE_FIND_TELEOP = /--teleop\.port(?:=|\s+)(\S+)/;
  const RE_FIND_ROBOT = /--robot\.port(?:=|\s+)(\S+)/;
  const RE_FIND_DSET_ROOT = /--dataset\.root(?:=|\s+)(\S+)/;
  const RE_FIND_DSET_REPO = /--dataset\.repo_id(?:=|\s+)(\S+)/;
  const RE_FIND_PUSH = /--dataset\.push_to_hub(?:=|\s+)(\S+)/;

  // Workdir (project dir)
  const RE_FIND_CD = /(^|\n)\s*cd\s+(\S+)/m;
  const RE_FIND_MKDIR = /(^|\n)\s*mkdir\s+-p\s+(\S+)/m;

  // Train defaults
  const RE_FIND_POLICY_TYPE = /--policy\.type(?:=|\s+)(\S+)/;
  const RE_FIND_OUTPUT_DIR = /--output_dir(?:=|\s+)(\S+)/;
  const RE_FIND_JOB_NAME = /--job_name(?:=|\s+)(\S+)/;
  const RE_FIND_TRAIN_BASE = /(outputs\/train\/[^\/\s]+)(?=\/checkpoints\/|\/|\s|$)/;

  // ---------- Helpers ----------
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

  function collectCodeBlocks(root = document) {
    return qsa("pre > code", root);
  }

  function collectInlineCode(root = document) {
    return qsa("code", root).filter(
      (el) => !el.closest("pre") && !el.closest(".lerobot-port-panel")
    );
  }

  function stripQuotes(s) {
    const t = String(s || "").trim();
    if (
      (t.startsWith('"') && t.endsWith('"')) ||
      (t.startsWith("'") && t.endsWith("'"))
    ) {
      return t.slice(1, -1);
    }
    return t;
  }

  function normalizePath(p) {
    let s = stripQuotes(p);
    if (s.length > 1) s = s.replace(/\/+$/g, "");
    return s;
  }

  function parentDir(p) {
    const s = normalizePath(p);
    if (!s) return "";
    if (s === "/") return "/";
    const idx = s.lastIndexOf("/");
    if (idx <= 0) return "";
    return s.slice(0, idx);
  }

  function normalizeRepoId(repoId) {
    return stripQuotes(repoId).replace(/\s+/g, "");
  }

  function parseRepoId(repoId) {
    const s = normalizeRepoId(repoId);
    const parts = s.split("/");
    if (parts.length !== 2) return null;
    const owner = parts[0] || "";
    const name = parts[1] || "";
    if (!owner || !name) return null;
    return { owner, name };
  }

  function evalSlugFromSlug(slug) {
    const s = String(slug || "").trim();
    if (!s) return "";
    return s.startsWith("eval_") ? s : `eval_${s}`;
  }

  function isEvalRepoId(repoId) {
    const s = normalizeRepoId(repoId);
    if (!s) return false;
    if (s.includes("{{EVAL_")) return true;
    const parts = s.split("/");
    const name = parts.length === 2 ? parts[1] : parts[0];
    if (!name) return false;
    if (name.startsWith("eval_")) return true;
    if (name.endsWith("_eval")) return true;
    return false;
  }

  function isEvalDatasetPath(p) {
    const s = normalizePath(p);
    if (!s) return false;
    if (s.includes("{{EVAL_")) return true;
    const base = s.split("/").pop() || "";
    return base.startsWith("eval_") || base.endsWith("_eval");
  }

  // projectDir + repoId(owner/name) -> dataset dir (the value for --dataset.root)
  function joinDatasetDir(projectDir, datasetRepoId) {
    const root = normalizePath(projectDir);
    const parsed = parseRepoId(datasetRepoId);
    if (!root || !parsed) return "";
    return `${root}/${parsed.owner}/${parsed.name}`;
  }

  function escapeHtmlAttr(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Replace template placeholders like {{TELEOP_PORT}} inside code blocks.
  // Also supports common "broken" forms seen after copy/paste or plugins:
  // - {{ TELEOP_PORT }}
  // - TELEOP_PORT }}
  function applyPlaceholderMap(text, map) {
    let out = String(text || "");
    const keys = Object.keys(map || {});

    // 1) Normalize broken tokens into canonical {{KEY}} form.
    for (const key of keys) {
      const reKey = escapeRegExp(key);
      out = out.replace(new RegExp(String.raw`{{\s*${reKey}\s*}}`, "g"), `{{${key}}}`);
      out = out.replace(new RegExp(String.raw`\\b${reKey}\\s*}}`, "g"), `{{${key}}}`);
    }

    // 2) Replace canonical placeholders.
    for (const key of keys) {
      const val = map[key];
      // If a value is empty (e.g. invalid repo_id), keep the placeholder visible.
      if (val === undefined || val === null || String(val) === "") continue;
      out = replaceAllString(out, `{{${key}}}`, String(val));
    }
    return out;
  }

  function replaceAllString(haystack, needle, replacement) {
    if (!needle) return haystack;
    return haystack.split(needle).join(replacement);
  }

  function buildTrainConfigPath(trainOutputDir) {
    const d = String(trainOutputDir || "").trim();
    if (!d) return "";
    return `${d}/checkpoints/last/pretrained_model/train_config.json`;
  }

  function buildPolicyPath(trainOutputDir) {
    const d = String(trainOutputDir || "").trim();
    if (!d) return "";
    return `${d}/checkpoints/last/pretrained_model`;
  }

  function truthy(s) {
    const v = String(s || "").trim().toLowerCase();
    if (!v) return false;
    if (v === "true" || v === "1" || v === "yes" || v === "y") return true;
    return false;
  }

  // Workspace -> Project Dir
  // - If input already ends with "/lerobot", treat it as projectDir.
  // - Else projectDir = <workspace>/lerobot
  function deriveProjectDirFromWorkspaceInput(workspaceInput) {
    const raw = normalizePath(workspaceInput);
    if (!raw) return { workspaceDir: "", projectDir: "" };
    if (raw.endsWith("/lerobot")) {
      return { workspaceDir: parentDir(raw), projectDir: raw };
    }
    return { workspaceDir: raw, projectDir: `${raw}/lerobot` };
  }

  function extractWorkspaceDirFromAnyPath(p) {
    const s = normalizePath(p);
    if (!s) return "";
    const marker = "/lerobot";
    const idx = s.indexOf(marker);
    if (idx === -1) return "";
    const before = s.slice(0, idx);
    return before || "/";
  }

  function deriveTrainRunName(defaults, datasetSlug) {
    const base = String(defaults.trainRunName || "").trim();
    const oldSlug = String(defaults.datasetSlug || "").trim();
    const policyType = String(defaults.policyType || "").trim();

    const newSlug = String(datasetSlug || "").trim();
    if (!newSlug) return base;

    if (base && oldSlug && base.includes(oldSlug)) {
      return base.split(oldSlug).join(newSlug);
    }
    if (policyType) return `${policyType}_${newSlug}`;
    return base || newSlug;
  }

  function deriveTrainOutputDir(defaults, trainRunName, projectDir) {
    const baseDir = String(defaults.trainOutputDir || "").trim();
    const run = String(trainRunName || "").trim();
    if (!run) return baseDir;

    // Keep whatever style the document used.
    if (baseDir) {
      // outputs/train/<run>
      if (baseDir.includes("outputs/train/")) {
        return baseDir.replace(/(outputs\/train\/)([^\/\s]+)/, `$1${run}`);
      }
      // relative models/<run>
      if (baseDir.startsWith("models/")) {
        return baseDir.replace(/^(models\/)([^\/\s]+)/, `$1${run}`);
      }
      // absolute .../lerobot/models/<run>
      if (baseDir.includes("/models/")) {
        return baseDir.replace(/(\/models\/)([^\/\s]+)/, `$1${run}`);
      }
    }

    // Default (this page's convention)
    // Use relative path because docs typically do: cd <project> then run commands.
    return `models/${run}`;
  }

  // ---------- Defaults from doc ----------
  function guessDefaultsFromDoc(codeNodes) {
    let teleop = "";
    let robot = "";
    let datasetRepoId = "";
    let docDatasetRootValue = ""; // the actual value found in --dataset.root in the doc
    let pushToHubRaw = "";

    let docProjectDir = ""; // from cd / mkdir -p in doc if present
    let workspaceDir = "";

    let policyType = "";
    let trainOutputDir = "";
    let trainRunName = "";

    // Scan all code nodes
    for (const code of codeNodes) {
      const t = code.textContent || "";

      if (!teleop) {
        const m = t.match(RE_FIND_TELEOP);
        if (m && m[1]) teleop = m[1];
      }
      if (!robot) {
        const m = t.match(RE_FIND_ROBOT);
        if (m && m[1]) robot = m[1];
      }
      if (!datasetRepoId) {
        const m = t.match(RE_FIND_DSET_REPO);
        if (m && m[1]) datasetRepoId = m[1];
      }
      if (!docDatasetRootValue) {
        const m = t.match(RE_FIND_DSET_ROOT);
        if (m && m[1]) docDatasetRootValue = m[1];
      }
      if (!pushToHubRaw) {
        const m = t.match(RE_FIND_PUSH);
        if (m && m[1]) pushToHubRaw = m[1];
      }

      // Try to find project dir from cd/mkdir
      if (!docProjectDir) {
        const mCd = t.match(RE_FIND_CD);
        if (mCd && mCd[2]) {
          const p = normalizePath(mCd[2]);
          if (p.endsWith("/lerobot")) docProjectDir = p;
        }
      }
      if (!docProjectDir) {
        const mMk = t.match(RE_FIND_MKDIR);
        if (mMk && mMk[2]) {
          const p = normalizePath(mMk[2]);
          if (p.endsWith("/lerobot")) docProjectDir = p;
        }
      }

      // Train defaults
      if (!policyType) {
        const m = t.match(RE_FIND_POLICY_TYPE);
        if (m && m[1]) policyType = stripQuotes(m[1]);
      }
      if (!trainOutputDir) {
        const m = t.match(RE_FIND_OUTPUT_DIR);
        if (m && m[1]) trainOutputDir = stripQuotes(m[1]);
      }
      if (!trainRunName) {
        const m = t.match(RE_FIND_JOB_NAME);
        if (m && m[1]) trainRunName = stripQuotes(m[1]);
      }
      if (!trainOutputDir) {
        const m = t.match(RE_FIND_TRAIN_BASE);
        if (m && m[1]) trainOutputDir = stripQuotes(m[1]);
      }

      // Early exit if we have the key pieces
      if (teleop && robot && datasetRepoId && docDatasetRootValue && docProjectDir && policyType && trainOutputDir && trainRunName && pushToHubRaw) {
        break;
      }
    }

    // Fallbacks
    if (!teleop) teleop = "/dev/ttyACM1";
    if (!robot) robot = "/dev/ttyACM0";

    if (!datasetRepoId) datasetRepoId = "local/1cam_test";
    datasetRepoId = normalizeRepoId(datasetRepoId);

    // Workspace inference
    if (docProjectDir) {
      workspaceDir = parentDir(docProjectDir);
    }
    if (!workspaceDir && docDatasetRootValue) {
      workspaceDir = extractWorkspaceDirFromAnyPath(docDatasetRootValue);
    }
    if (!workspaceDir) workspaceDir = "/home/jetson";
    workspaceDir = normalizePath(workspaceDir);

    const { projectDir } = deriveProjectDirFromWorkspaceInput(workspaceDir);

    const parsed = parseRepoId(datasetRepoId);
    const datasetSlug = parsed?.name || "";
    const datasetDir = joinDatasetDir(projectDir, datasetRepoId);

    if (!policyType) policyType = "act";

    // Train output defaults
    if (!trainRunName && policyType && datasetSlug) {
      trainRunName = `${policyType}_${datasetSlug}`;
    }
    if (!trainOutputDir && trainRunName) {
      trainOutputDir = `models/${trainRunName}`;
    }

    const pushToHub = truthy(pushToHubRaw);

    return {
      teleop,
      robot,
      workspaceDir,
      projectDir,
      datasetRepoId,
      datasetSlug,
      datasetDir,
      docDatasetRootValue: normalizePath(docDatasetRootValue),
      policyType,
      trainRunName,
      trainOutputDir,
      pushToHub
    };
  }

  // ---------- UI ----------
  function renderPanel(panelEl, state, defaults, onChange) {
    if (panelEl.dataset.lerobotInitialized === "true") return;
    panelEl.dataset.lerobotInitialized = "true";
    panelEl.classList.add("lerobot-port-panel");

    const datalistId = "lerobot-port-suggestions";

    panelEl.innerHTML = `
      <form class="lerobot-port-form" autocomplete="off">
        <div class="lerobot-port-row">
          <label class="lerobot-port-label" for="lerobot-teleop-port">teleop.port（Leader）</label>
          <input
            id="lerobot-teleop-port"
            class="lerobot-port-input"
            type="text"
            inputmode="text"
            list="${datalistId}"
            placeholder="${escapeHtmlAttr(defaults.teleop)}"
            value="${escapeHtmlAttr(state.teleop)}"
          />
        </div>

        <div class="lerobot-port-row">
          <label class="lerobot-port-label" for="lerobot-robot-port">robot.port（Follower）</label>
          <input
            id="lerobot-robot-port"
            class="lerobot-port-input"
            type="text"
            inputmode="text"
            list="${datalistId}"
            placeholder="${escapeHtmlAttr(defaults.robot)}"
            value="${escapeHtmlAttr(state.robot)}"
          />
        </div>

        <datalist id="${datalistId}">
          <option value="/dev/ttyACM0"></option>
          <option value="/dev/ttyACM1"></option>
          <option value="/dev/ttyUSB0"></option>
          <option value="/dev/ttyUSB1"></option>
          <option value="/dev/tty.usbmodemXXXXXXXXXXXX"></option>
        </datalist>

        <div class="lerobot-port-row">
          <label class="lerobot-port-label" for="lerobot-workspace-dir">workspace dir</label>
          <input
            id="lerobot-workspace-dir"
            class="lerobot-port-input"
            type="text"
            inputmode="text"
            placeholder="${escapeHtmlAttr(defaults.workspaceDir)}"
            value="${escapeHtmlAttr(state.workspaceDir)}"
          />
        </div>

        <div class="lerobot-port-row">
          <label class="lerobot-port-label" for="lerobot-dataset-repo">dataset.repo_id（user/id）</label>
          <input
            id="lerobot-dataset-repo"
            class="lerobot-port-input"
            type="text"
            inputmode="text"
            placeholder="${escapeHtmlAttr(defaults.datasetRepoId)}"
            value="${escapeHtmlAttr(state.datasetRepoId)}"
          />
        </div>

        <div class="lerobot-port-row">
          <label class="lerobot-port-label" for="lerobot-push-to-hub">Hugging Faceにアップ</label>
          <div style="display:flex;align-items:center;gap:10px;">
            <input id="lerobot-push-to-hub" type="checkbox" ${state.pushToHub ? "checked" : ""} />
            <span style="opacity:.85;">dataset.push_to_hub=${state.pushToHub ? "true" : "false"}</span>
          </div>
        </div>

        <div class="lerobot-port-row lerobot-port-row--derived">
          <div class="lerobot-port-label">作業フォルダ（project）</div>
          <div class="lerobot-port-derived"><code id="lerobot-project-dir"></code></div>
        </div>

        <div class="lerobot-port-row lerobot-port-row--derived">
          <div class="lerobot-port-label">dataset.root（実体）</div>
          <div class="lerobot-port-derived">
            <code id="lerobot-dataset-dir"></code>
            <div id="lerobot-repoid-warning" class="lerobot-port-warning" style="display:none;"></div>
          </div>
        </div>

        <div class="lerobot-port-row lerobot-port-row--derived">
          <div class="lerobot-port-label">model dir</div>
          <div class="lerobot-port-derived"><code id="lerobot-model-dir"></code></div>
        </div>

        <div class="lerobot-port-actions">
          <button type="button" class="lerobot-port-btn" data-action="reset">初期値に戻す</button>
          <button type="button" class="lerobot-port-btn" data-action="clear">保存を消す</button>
        </div>
      </form>
    `;

    const teleopInput = panelEl.querySelector("#lerobot-teleop-port");
    const robotInput = panelEl.querySelector("#lerobot-robot-port");
    const wsInput = panelEl.querySelector("#lerobot-workspace-dir");
    const repoInput = panelEl.querySelector("#lerobot-dataset-repo");
    const pushInput = panelEl.querySelector("#lerobot-push-to-hub");

    const projectEl = panelEl.querySelector("#lerobot-project-dir");
    const datasetEl = panelEl.querySelector("#lerobot-dataset-dir");
    const modelEl = panelEl.querySelector("#lerobot-model-dir");
    const warnEl = panelEl.querySelector("#lerobot-repoid-warning");

    function refreshDerived() {
      const repo = normalizeRepoId(repoInput.value || defaults.datasetRepoId);
      const wsRaw = normalizePath(wsInput.value || defaults.workspaceDir);
      const { workspaceDir, projectDir } = deriveProjectDirFromWorkspaceInput(wsRaw);

      const parsed = parseRepoId(repo);
      const datasetDir = joinDatasetDir(projectDir, repo);

      projectEl.textContent = projectDir || "";
      datasetEl.textContent = parsed ? datasetDir : "(repo_id が不正です)";

      const slug = parsed?.name || "";
      const runName = deriveTrainRunName(defaults, slug);
      modelEl.textContent = projectDir && runName ? `${projectDir}/models/${runName}` : "";

      if (!parsed) {
        warnEl.style.display = "block";
        warnEl.textContent = "repo_id は user/id 形式にしてください（例: local/1cam_test）";
      } else {
        warnEl.style.display = "none";
        warnEl.textContent = "";
      }

      // Keep workspace normalized in the UI if user typed /.../lerobot
      if (wsRaw.endsWith("/lerobot") && workspaceDir) {
        wsInput.value = workspaceDir;
      }
    }

    const fire = () => {
      const teleop = (teleopInput.value || "").trim() || defaults.teleop;
      const robot = (robotInput.value || "").trim() || defaults.robot;
      const wsRaw = normalizePath((wsInput.value || "").trim() || defaults.workspaceDir);
      const repo = normalizeRepoId((repoInput.value || "").trim() || defaults.datasetRepoId);
      const pushToHub = !!pushInput.checked;

      const { workspaceDir } = deriveProjectDirFromWorkspaceInput(wsRaw);

      refreshDerived();
      onChange({ teleop, robot, workspaceDir, datasetRepoId: repo, pushToHub });
    };

    teleopInput.addEventListener("input", fire);
    robotInput.addEventListener("input", fire);
    wsInput.addEventListener("input", fire);
    repoInput.addEventListener("input", fire);
    pushInput.addEventListener("change", fire);

    panelEl.querySelector('[data-action="reset"]').addEventListener("click", () => {
      teleopInput.value = defaults.teleop;
      robotInput.value = defaults.robot;
      wsInput.value = defaults.workspaceDir;
      repoInput.value = defaults.datasetRepoId;
      pushInput.checked = !!defaults.pushToHub;
      fire();
    });

    panelEl.querySelector('[data-action="clear"]').addEventListener("click", () => {
      safeDel(LS_KEY_TELEOP);
      safeDel(LS_KEY_ROBOT);
      safeDel(LS_KEY_WORKSPACE);
      safeDel(LS_KEY_DATASET_REPO);
      safeDel(LS_KEY_PUSH_TO_HUB);
    });

    refreshDerived();
  }

  // ---------- Apply replacements ----------
  function applyToCodeNodes(codeNodes, cfg, defaults) {
    const repo = parseRepoId(cfg.datasetRepoId);
    const owner = repo?.owner || "";
    const slug = repo?.name || "";

    const { projectDir } = deriveProjectDirFromWorkspaceInput(cfg.workspaceDir);
    const datasetDir = joinDatasetDir(projectDir, cfg.datasetRepoId);

    const evalDatasetSlug = slug ? evalSlugFromSlug(slug) : "";
    const evalDatasetRepoId = owner && evalDatasetSlug ? `${owner}/${evalDatasetSlug}` : "";
    const evalDatasetDir = evalDatasetRepoId ? joinDatasetDir(projectDir, evalDatasetRepoId) : "";

    const trainRunName = deriveTrainRunName(defaults, slug);
    const trainOutputDir = deriveTrainOutputDir(defaults, trainRunName, projectDir);
    const trainConfigPath = buildTrainConfigPath(trainOutputDir);
    const policyPath = buildPolicyPath(trainOutputDir);

    // Placeholder values used in markdown (code blocks / inline code)
    // Notes:
    // - DATASET_DIR: dataset.root (actual dataset directory)
    // - DATASET_ROOT: backward compatible alias for DATASET_DIR
    // - PROJECT_DIR / LEROBOT_DIR: <workspace>/lerobot
    const placeholders = {
      TELEOP_PORT: cfg.teleop,
      ROBOT_PORT: cfg.robot,
      WORKSPACE_DIR: cfg.workspaceDir,

      PROJECT_DIR: projectDir,
      LEROBOT_DIR: projectDir,

      DATASET_REPO_ID: cfg.datasetRepoId,
      DATASET_SLUG: slug,
      DATASET_DIR: datasetDir,
      DATASET_ROOT: datasetDir,

      TRAIN_RUN_NAME: trainRunName,
      TRAIN_OUTPUT_DIR: trainOutputDir,
      TRAIN_CONFIG_PATH: trainConfigPath,
      POLICY_PATH: policyPath,

      MODELS_DIR: projectDir ? `${projectDir}/models` : "",
      MODEL_DIR: projectDir && trainRunName ? `${projectDir}/models/${trainRunName}` : "",

      EVAL_DATASET_REPO_ID: evalDatasetRepoId,
      EVAL_DATASET_DIR: evalDatasetDir,
      EVAL_DATASET_SLUG: evalDatasetSlug
    };

    for (const code of codeNodes) {
      if (!code.dataset.lerobotTemplate) {
        code.dataset.lerobotTemplate = code.textContent || "";
      }
      let out = code.dataset.lerobotTemplate;

      // --- Placeholder replacement (robust: handles "TELEOP_PORT }}" etc.) ---
      out = applyPlaceholderMap(out, placeholders);

      // --- Option replacement ---
      out = out.replace(RE_TELEOP_EQ, `$1${cfg.teleop}`);
      out = out.replace(RE_TELEOP_SP, `$1${cfg.teleop}`);
      out = out.replace(RE_ROBOT_EQ, `$1${cfg.robot}`);
      out = out.replace(RE_ROBOT_SP, `$1${cfg.robot}`);

      // push_to_hub toggle
      const pushStr = cfg.pushToHub ? "true" : "false";
      out = out.replace(RE_PUSH_EQ, `$1${pushStr}`);
      out = out.replace(RE_PUSH_SP, `$1${pushStr}`);

      // dataset.repo_id (normal/eval)
      const chooseRepoId = (currentValue) => {
        if (isEvalRepoId(currentValue)) {
          return evalDatasetRepoId || cfg.datasetRepoId;
        }
        return cfg.datasetRepoId;
      };
      out = out.replace(RE_DSET_REPO_EQ, (m, prefix, value) => `${prefix}${chooseRepoId(value)}`);
      out = out.replace(RE_DSET_REPO_SP, (m, prefix, value) => `${prefix}${chooseRepoId(value)}`);

      // dataset.root (always datasetDir; eval block -> evalDatasetDir)
      const chooseDatasetRootValue = (currentValue) => {
        if (isEvalDatasetPath(currentValue) || isEvalRepoId(currentValue)) {
          return evalDatasetDir || datasetDir || projectDir;
        }
        return datasetDir || projectDir;
      };
      out = out.replace(RE_DSET_ROOT_EQ, (m, prefix, value) => `${prefix}${chooseDatasetRootValue(value)}`);
      out = out.replace(RE_DSET_ROOT_SP, (m, prefix, value) => `${prefix}${chooseDatasetRootValue(value)}`);

      // Hydra dataset.path
      if (datasetDir) {
        out = out.replace(RE_DATASET_PATH_EQ, `$1${datasetDir}`);
        out = out.replace(RE_DATASET_PATH_SP, `$1${datasetDir}`);
      }

      // Train options
      if (trainRunName) {
        out = out.replace(RE_JOB_NAME_EQ, `$1${trainRunName}`);
        out = out.replace(RE_JOB_NAME_SP, `$1${trainRunName}`);
      }
      if (trainOutputDir) {
        out = out.replace(RE_OUTPUT_DIR_EQ, `$1${trainOutputDir}`);
        out = out.replace(RE_OUTPUT_DIR_SP, `$1${trainOutputDir}`);
      }
      if (trainConfigPath) {
        out = out.replace(RE_CONFIG_PATH_EQ, `$1${trainConfigPath}`);
        out = out.replace(RE_CONFIG_PATH_SP, `$1${trainConfigPath}`);
      }
      if (policyPath) {
        out = out.replace(RE_POLICY_PATH_EQ, `$1${policyPath}`);
        out = out.replace(RE_POLICY_PATH_SP, `$1${policyPath}`);
      }

      // --- Path replacements in text (rm -rf / inline paths) ---
      // Replace any exact matches from the original doc.
      if (defaults.docDatasetRootValue && datasetDir) {
        out = replaceAllString(out, defaults.docDatasetRootValue, datasetDir);
      }

      // Replace old train output mentions
      if (defaults.trainOutputDir && trainOutputDir) {
        out = replaceAllString(out, defaults.trainOutputDir, trainOutputDir);
      }
      if (defaults.trainRunName && trainRunName) {
        out = replaceAllString(out, defaults.trainRunName, trainRunName);
      }

      // Replace outputs/train/<run> and models/<run> occurrences if present.
      if (defaults.trainRunName && trainRunName) {
        out = out
          .replaceAll(`outputs/train/${defaults.trainRunName}`, `outputs/train/${trainRunName}`)
          .replaceAll(`models/${defaults.trainRunName}`, `models/${trainRunName}`);
      }

      // rm -rf rewrite (only if it seems to target this dataset)
      out = out.replace(RE_RM_RF, (m, prefix, path) => {
        const p = normalizePath(path);
        if (!p) return m;

        // Eval dataset
        if (evalDatasetDir && owner && evalDatasetSlug) {
          const key = `/${owner}/${evalDatasetSlug}`;
          if (p.endsWith(key) || p.includes(key)) {
            return `${prefix}${evalDatasetDir}`;
          }
        }

        // Normal dataset
        if (datasetDir && owner && slug) {
          const key = `/${owner}/${slug}`;
          if (p.endsWith(key) || p.includes(key)) {
            return `${prefix}${datasetDir}`;
          }
        }

        // If it was exactly the doc's dataset.root value, rewrite it.
        if (defaults.docDatasetRootValue && p === normalizePath(defaults.docDatasetRootValue) && datasetDir) {
          return `${prefix}${datasetDir}`;
        }

        return m;
      });

      // cd / mkdir -p rewrite (work folder)
      out = out.replace(RE_CD_LINE, (m, prefix, path, suffix) => {
        const p = normalizePath(path);
        if (!p) return m;

        // If the doc had cd <some>/lerobot, keep it synced.
        if (p.endsWith("/lerobot")) {
          return `${prefix}${projectDir}${suffix}`;
        }
        return m;
      });

      out = out.replace(RE_MKDIR_P, (m, prefix, path, suffix) => {
        const p = normalizePath(path);
        if (!p) return m;
        if (p.endsWith("/lerobot")) {
          return `${prefix}${projectDir}${suffix}`;
        }
        return m;
      });

      code.textContent = out;
    }
  }

  // ---------- Init ----------
  function init(root = document) {
    const panel = root.querySelector("[data-lerobot-port-panel]");
    if (!panel) return;

    const scope = panel.closest("article") || panel.closest("main") || root;
    const codeBlocks = collectCodeBlocks(scope);
    const inlineCodes = collectInlineCode(scope);
    const codeNodes = [...codeBlocks, ...inlineCodes];

    const defaults = guessDefaultsFromDoc(codeNodes);

    // Load state
    const savedTeleop = safeGet(LS_KEY_TELEOP);
    const savedRobot = safeGet(LS_KEY_ROBOT);
    const savedRepo = safeGet(LS_KEY_DATASET_REPO);
    const savedWs = safeGet(LS_KEY_WORKSPACE);
    const savedPush = safeGet(LS_KEY_PUSH_TO_HUB);

    // Migration: if workspace not stored, try legacy dataset_root to infer.
    let workspaceDir = normalizePath(savedWs || "");
    if (!workspaceDir) {
      const legacy = normalizePath(safeGet(LS_KEY_LEGACY_DATASET_ROOT) || "");
      if (legacy) {
        // If legacy looks like /.../lerobot/datasets, infer workspace from it.
        const ws = extractWorkspaceDirFromAnyPath(legacy) || parentDir(legacy);
        workspaceDir = ws;
      }
    }
    if (!workspaceDir) workspaceDir = defaults.workspaceDir;

    const state = {
      teleop: (savedTeleop || defaults.teleop).trim(),
      robot: (savedRobot || defaults.robot).trim(),
      workspaceDir,
      datasetRepoId: normalizeRepoId(savedRepo || defaults.datasetRepoId),
      pushToHub: savedPush ? truthy(savedPush) : !!defaults.pushToHub
    };

    renderPanel(panel, state, defaults, ({ teleop, robot, workspaceDir, datasetRepoId, pushToHub }) => {
      safeSet(LS_KEY_TELEOP, teleop);
      safeSet(LS_KEY_ROBOT, robot);
      safeSet(LS_KEY_WORKSPACE, workspaceDir);
      safeSet(LS_KEY_DATASET_REPO, datasetRepoId);
      safeSet(LS_KEY_PUSH_TO_HUB, pushToHub ? "true" : "false");

      applyToCodeNodes(codeNodes, { teleop, robot, workspaceDir, datasetRepoId, pushToHub }, defaults);
    });

    // Initial apply
    applyToCodeNodes(codeNodes, state, defaults);
  }

  // Material for MkDocs instant loading support
  if (window.document$ && typeof window.document$.subscribe === "function") {
    window.document$.subscribe(() => init(document));
  } else {
    document.addEventListener("DOMContentLoaded", () => init(document));
  }
})();
