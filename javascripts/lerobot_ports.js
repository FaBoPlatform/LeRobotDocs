(() => {
  "use strict";

  // ==========================================================
  // LeRobot Port / Path Panel (MkDocs Material)
  // ----------------------------------------------------------
  // 変更点（常軌 md に合わせる）
  // - --dataset.root は「datasets base dir + repo_id」(= dataset dir) を自動生成して差し替え
  //   ※入力欄は base dir を推奨するが、dataset dir を貼っても自動で base に正規化
  // - models 生成ルール: models/<policy_type>_<dataset_slug> を自動生成し、
  //   --output_dir / --job_name / --config_path / --policy.path 等を同期
  // ==========================================================

  // ---------- LocalStorage keys ----------
  const LS_KEY_TELEOP = "lerobot.teleop_port";
  const LS_KEY_ROBOT = "lerobot.robot_port";

  // NOTE:
  // 互換性のためキー名は維持（"dataset_root"）していますが、
  // 本スクリプトでは "datasets base dir"（例: /home/jetson/lerobot/datasets）として扱います。
  const LS_KEY_DATASET_ROOT = "lerobot.dataset_root";

  const LS_KEY_DATASET_REPO = "lerobot.dataset_repo_id";

  // ---------- Replace targets (support "=value" and " value") ----------
  const RE_TELEOP_EQ = /(--teleop\.port=)(\S+)/g;
  const RE_TELEOP_SP = /(--teleop\.port\s+)(\S+)/g;
  const RE_ROBOT_EQ = /(--robot\.port=)(\S+)/g;
  const RE_ROBOT_SP = /(--robot\.port\s+)(\S+)/g;

  // LeRobot dataset options
  const RE_DSET_ROOT_EQ = /(--dataset\.root=)(\S+)/g;
  const RE_DSET_ROOT_SP = /(--dataset\.root\s+)(\S+)/g;
  const RE_DSET_REPO_EQ = /(--dataset\.repo_id=)(\S+)/g;
  const RE_DSET_REPO_SP = /(--dataset\.repo_id\s+)(\S+)/g;

  // Hydra style (train): dataset.path=
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

  // For guessing defaults from the document
  const RE_FIND_TELEOP = /--teleop\.port(?:=|\s+)(\S+)/;
  const RE_FIND_ROBOT = /--robot\.port(?:=|\s+)(\S+)/;
  const RE_FIND_DSET_ROOT = /--dataset\.root(?:=|\s+)(\S+)/;
  const RE_FIND_DSET_REPO = /--dataset\.repo_id(?:=|\s+)(\S+)/;

  // Train defaults
  const RE_FIND_POLICY_TYPE = /--policy\.type(?:=|\s+)(\S+)/;
  const RE_FIND_OUTPUT_DIR = /--output_dir(?:=|\s+)(\S+)/;
  const RE_FIND_JOB_NAME = /--job_name(?:=|\s+)(\S+)/;

  // Fallback: infer base dir from paths like "outputs/train/<run>/checkpoints/..."
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
    // Works for standard MkDocs/Material output
    return qsa("pre > code", root);
  }

  function collectInlineCode(root = document) {
    // Inline code like `models/.../train_config.json`
    // (exclude code blocks + our own panel)
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

  // Normalize "/path///" -> "/path"
  function normalizePath(p) {
    let s = stripQuotes(p);
    // Remove trailing slashes (but keep "/" itself)
    if (s.length > 1) s = s.replace(/\/+$/g, "");
    return s;
  }

  function parentDir(p) {
    const s = normalizePath(p);
    if (!s) return "";
    if (s === "/") return "/";
    const idx = s.lastIndexOf("/");
    if (idx <= 0) return ""; // no parent
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

    // Explicit placeholder in templates
    if (s.includes("{{EVAL_")) return true;

    // Accept both "owner/eval_xxx" and "eval_xxx" styles.
    const parts = s.split("/");
    const name = parts.length === 2 ? parts[1] : parts[0];
    if (!name) return false;

    // Preferred style: eval_ prefix
    if (name.startsWith("eval_")) return true;

    // Backward compatibility: *_eval suffix
    if (name.endsWith("_eval")) return true;

    return false;
  }

  function isEvalDatasetRootPath(p) {
    const s = normalizePath(p);
    if (!s) return false;
    if (s.includes("{{EVAL_")) return true;
    const base = s.split("/").pop() || "";
    return base.startsWith("eval_") || base.endsWith("_eval");
  }

  // datasets base dir + repoId(owner/name) -> dataset dir
  function joinDatasetDir(datasetBaseDir, datasetRepoId) {
    const root = normalizePath(datasetBaseDir);
    const parsed = parseRepoId(datasetRepoId);
    if (!root || !parsed) return "";
    return `${root}/${parsed.owner}/${parsed.name}`;
  }

  // dataset.root 入力欄に datasetDir が貼られても baseDir に正規化する
  function inferDatasetBaseDirFromInput(datasetRootInput, datasetRepoId) {
    const p = normalizePath(datasetRootInput);
    const parsed = parseRepoId(datasetRepoId);
    if (!p) return "";

    // If it looks like ".../<owner>/<name>", strip that suffix to get baseDir.
    if (parsed) {
      const suffix = `/${parsed.owner}/${parsed.name}`;
      if (p.endsWith(suffix)) {
        const base = p.slice(0, -suffix.length);
        return base || "/";
      }
    }
    return p;
  }

  function escapeHtmlAttr(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
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

  function deriveTrainRunName(defaults, datasetSlug) {
    const base = String(defaults.trainRunName || "").trim();
    const oldSlug = String(defaults.datasetSlug || "").trim();
    const policyType = String(defaults.policyType || "").trim();

    const newSlug = String(datasetSlug || "").trim();
    if (!newSlug) return base;

    // Prefer: replace the original datasetSlug segment in the original runName.
    if (base && oldSlug && base.includes(oldSlug)) {
      return base.split(oldSlug).join(newSlug);
    }

    // Fallback: build from policy.type + datasetSlug.
    if (policyType) return `${policyType}_${newSlug}`;

    // Last resort
    return base || newSlug;
  }

  // 常軌 md: models/<run> が基本。outputs/train/ を使うページも壊さないように両対応。
  function deriveTrainOutputDir(defaults, trainRunName) {
    const baseDir = String(defaults.trainOutputDir || "").trim();
    const run = String(trainRunName || "").trim();
    if (!run) return baseDir;

    if (baseDir) {
      // outputs/train/<run>
      if (baseDir.includes("outputs/train/")) {
        return baseDir.replace(/(outputs\/train\/)([^\/\s]+)/, `$1${run}`);
      }

      // models/<run> (relative)
      if (baseDir.startsWith("models/")) {
        return baseDir.replace(/^(models\/)([^\/\s]+)/, `$1${run}`);
      }

      // /.../models/<run> (absolute)
      if (baseDir.includes("/models/")) {
        return baseDir.replace(/(\/models\/)([^\/\s]+)/, `$1${run}`);
      }
    }

    // Default to 常軌 md style
    return `models/${run}`;
  }

  // ---------- Defaults from doc ----------
  function guessDefaultsFromDoc(codeNodes) {
    let teleop = "";
    let robot = "";
    let datasetRootRaw = ""; // may be base or dataset dir depending on the doc
    let datasetRepoId = "";

    let policyType = "";
    let trainOutputDir = "";
    let trainRunName = "";

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
      if (!datasetRootRaw) {
        const m = t.match(RE_FIND_DSET_ROOT);
        if (m && m[1]) datasetRootRaw = m[1];
      }
      if (!datasetRepoId) {
        const m = t.match(RE_FIND_DSET_REPO);
        if (m && m[1]) datasetRepoId = m[1];
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

      if (
        teleop &&
        robot &&
        datasetRootRaw &&
        datasetRepoId &&
        policyType &&
        trainOutputDir &&
        trainRunName
      )
        break;
    }

    // Fallbacks (only used if doc doesn't contain them)
    if (!teleop) teleop = "/dev/ttyACM1";
    if (!robot) robot = "/dev/ttyACM0";

    if (!datasetRepoId) datasetRepoId = "local/1cam_test";
    datasetRepoId = normalizeRepoId(datasetRepoId);

    // datasetRootRaw が datasetDir っぽい場合に備えて baseDir 化する
    if (!datasetRootRaw) {
      // 常軌 md のデフォルト（プロジェクト配下）
      datasetRootRaw = "/home/jetson/lerobot/datasets";
    }
    datasetRootRaw = normalizePath(datasetRootRaw);
    const datasetBaseDir = inferDatasetBaseDirFromInput(datasetRootRaw, datasetRepoId);

    const datasetDir = joinDatasetDir(datasetBaseDir, datasetRepoId);
    const slug = parseRepoId(datasetRepoId)?.name || "";
    const workspaceDir = parentDir(datasetBaseDir);

    if (!policyType) policyType = "act";

    // Train output defaults (if doc didn't contain them)
    if (!trainRunName && policyType && slug) {
      trainRunName = `${policyType}_${slug}`;
    }
    if (!trainOutputDir && trainRunName) {
      // 常軌 md: models/<run>
      trainOutputDir = `models/${trainRunName}`;
    }

    return {
      teleop,
      robot,

      // For compatibility: keep the prop name "datasetRoot", but it's a base dir
      datasetRoot: datasetBaseDir,
      datasetRepoId,
      datasetDir,
      datasetSlug: slug,
      workspaceDir,

      policyType,
      trainRunName,
      trainOutputDir
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
          <label class="lerobot-port-label" for="lerobot-dataset-root">
            datasets base dir<br /><span style="font-weight:400;opacity:.8;">（例: /home/jetson/lerobot/datasets）</span>
          </label>
          <input
            id="lerobot-dataset-root"
            class="lerobot-port-input"
            type="text"
            inputmode="text"
            placeholder="${escapeHtmlAttr(defaults.datasetRoot)}"
            value="${escapeHtmlAttr(state.datasetRoot)}"
          />
        </div>

        <div class="lerobot-port-row">
          <label class="lerobot-port-label" for="lerobot-dataset-repo">
            dataset.repo_id<br /><span style="font-weight:400;opacity:.8;">（owner/name）</span>
          </label>
          <input
            id="lerobot-dataset-repo"
            class="lerobot-port-input"
            type="text"
            inputmode="text"
            placeholder="${escapeHtmlAttr(defaults.datasetRepoId)}"
            value="${escapeHtmlAttr(state.datasetRepoId)}"
          />
        </div>

        <div class="lerobot-port-row lerobot-port-row--derived">
          <div class="lerobot-port-label">workspace dir（cd先）</div>
          <div class="lerobot-port-derived">
            <code id="lerobot-workspace-dir"></code>
          </div>
        </div>

        <div class="lerobot-port-row lerobot-port-row--derived">
          <div class="lerobot-port-label">dataset.root（実際に使うパス）</div>
          <div class="lerobot-port-derived">
            <code id="lerobot-dataset-dir"></code>
            <div id="lerobot-repoid-warning" class="lerobot-port-warning" style="display:none;"></div>
          </div>
        </div>

        <div class="lerobot-port-row lerobot-port-row--derived">
          <div class="lerobot-port-label">eval dataset（推論用）</div>
          <div class="lerobot-port-derived">
            <code id="lerobot-eval-repo-id"></code>
            <br />
            <code id="lerobot-eval-dataset-dir"></code>
          </div>
        </div>

        <div class="lerobot-port-row lerobot-port-row--derived">
          <div class="lerobot-port-label">models（学習/推論）</div>
          <div class="lerobot-port-derived">
            <div style="margin-bottom:4px;opacity:.85;">run name</div>
            <code id="lerobot-train-run-name"></code>
            <div style="margin:8px 0 4px;opacity:.85;">output dir</div>
            <code id="lerobot-train-output-dir"></code>
            <div style="margin:8px 0 4px;opacity:.85;">train_config.json</div>
            <code id="lerobot-train-config-path"></code>
            <div style="margin:8px 0 4px;opacity:.85;">policy.path</div>
            <code id="lerobot-policy-path"></code>
          </div>
        </div>

        <div class="lerobot-port-actions">
          <button type="button" class="lerobot-port-btn" data-action="reset">初期値に戻す</button>
          <button type="button" class="lerobot-port-btn" data-action="clear">保存を消す</button>
        </div>

        <div class="lerobot-port-hint">
          入力すると、このページ内のコードブロック / インラインコードに含まれる
          <code>--teleop.port</code> / <code>--robot.port</code> /
          <code>--dataset.repo_id</code> / <code>--dataset.root</code>（= datasets base dir + repo_id） /
          <code>dataset.path=</code> /
          <code>rm -rf ...</code>（datasets配下） /
          <code>cd ...</code>（作業フォルダ） /
          <code>--output_dir</code> / <code>--job_name</code> /
          <code>--config_path</code> / <code>--policy.path</code> /
          <code>models/.../</code> / <code>outputs/train/.../</code>
          を一括で差し替えます（localStorageに保存）。
          <br />
          プレースホルダ置換:
          <code>{{TELEOP_PORT}}</code>, <code>{{ROBOT_PORT}}</code>,
          <code>{{DATASET_ROOT}}</code>(datasets base dir),
          <code>{{DATASET_REPO_ID}}</code>, <code>{{DATASET_DIR}}</code>,
          <code>{{DATASET_SLUG}}</code>, <code>{{WORKSPACE_DIR}}</code>,
          <code>{{TRAIN_RUN_NAME}}</code>, <code>{{TRAIN_OUTPUT_DIR}}</code>,
          <code>{{TRAIN_CONFIG_PATH}}</code>, <code>{{POLICY_PATH}}</code>,
          <code>{{EVAL_DATASET_REPO_ID}}</code>, <code>{{EVAL_DATASET_DIR}}</code>,
          <code>{{EVAL_DATASET_SLUG}}</code>
        </div>
      </form>
    `;

    const teleopInput = panelEl.querySelector("#lerobot-teleop-port");
    const robotInput = panelEl.querySelector("#lerobot-robot-port");
    const dsRootInput = panelEl.querySelector("#lerobot-dataset-root");
    const dsRepoInput = panelEl.querySelector("#lerobot-dataset-repo");

    const wsDirEl = panelEl.querySelector("#lerobot-workspace-dir");
    const dsDirEl = panelEl.querySelector("#lerobot-dataset-dir");
    const warnEl = panelEl.querySelector("#lerobot-repoid-warning");
    const evalRepoEl = panelEl.querySelector("#lerobot-eval-repo-id");
    const evalDirEl = panelEl.querySelector("#lerobot-eval-dataset-dir");

    const trainRunEl = panelEl.querySelector("#lerobot-train-run-name");
    const trainOutEl = panelEl.querySelector("#lerobot-train-output-dir");
    const trainCfgEl = panelEl.querySelector("#lerobot-train-config-path");
    const policyPathEl = panelEl.querySelector("#lerobot-policy-path");

    function refreshDerived() {
      const repo = normalizeRepoId(dsRepoInput.value || defaults.datasetRepoId);
      const baseDirRaw = normalizePath(dsRootInput.value || defaults.datasetRoot);
      const baseDir = inferDatasetBaseDirFromInput(baseDirRaw, repo);
      const parsed = parseRepoId(repo);

      const workspaceDir = parentDir(baseDir);
      wsDirEl.textContent = workspaceDir || "(parent dir が取れません)";

      const datasetDir = joinDatasetDir(baseDir, repo);
      if (!baseDir) {
        dsDirEl.textContent = "";
      } else if (parsed) {
        dsDirEl.textContent = datasetDir;
      } else {
        dsDirEl.textContent = "(repo_id が不正です)";
      }

      // Eval dataset (for inference): <owner>/eval_<slug>
      if (evalRepoEl && evalDirEl) {
        if (parsed) {
          const evalSlug = evalSlugFromSlug(parsed.name);
          const evalRepoId = `${parsed.owner}/${evalSlug}`;
          evalRepoEl.textContent = evalRepoId;
          evalDirEl.textContent = baseDir ? `${baseDir}/${parsed.owner}/${evalSlug}` : "";
        } else {
          evalRepoEl.textContent = "";
          evalDirEl.textContent = "";
        }
      }

      // Models (train/infer): models/<policy_type>_<dataset_slug>
      const datasetSlug = parsed?.name || "";
      const runName = deriveTrainRunName(defaults, datasetSlug);
      const outDir = deriveTrainOutputDir(defaults, runName);
      const cfgPath = buildTrainConfigPath(outDir);
      const polPath = buildPolicyPath(outDir);

      if (trainRunEl) trainRunEl.textContent = runName || "";
      if (trainOutEl) trainOutEl.textContent = outDir || "";
      if (trainCfgEl) trainCfgEl.textContent = cfgPath || "";
      if (policyPathEl) policyPathEl.textContent = polPath || "";

      if (!parsed) {
        warnEl.style.display = "block";
        warnEl.textContent = "repo_id は owner/name 形式にしてください（例: local/1cam_test）";
      } else {
        warnEl.style.display = "none";
        warnEl.textContent = "";
      }
    }

    const fire = () => {
      const teleop = (teleopInput.value || "").trim() || defaults.teleop;
      const robot = (robotInput.value || "").trim() || defaults.robot;

      const datasetRepoId = normalizeRepoId(
        (dsRepoInput.value || "").trim() || defaults.datasetRepoId
      );

      // dataset root input: prefer base dir, but accept dataset dir (auto-normalize)
      const datasetRootRaw = normalizePath(
        (dsRootInput.value || "").trim() || defaults.datasetRoot
      );
      const datasetRoot = inferDatasetBaseDirFromInput(datasetRootRaw, datasetRepoId);

      refreshDerived();
      onChange({ teleop, robot, datasetRoot, datasetRepoId });
    };

    teleopInput.addEventListener("input", fire);
    robotInput.addEventListener("input", fire);
    dsRootInput.addEventListener("input", fire);
    dsRepoInput.addEventListener("input", fire);

    panelEl
      .querySelector('[data-action="reset"]')
      .addEventListener("click", () => {
        teleopInput.value = defaults.teleop;
        robotInput.value = defaults.robot;
        dsRootInput.value = defaults.datasetRoot;
        dsRepoInput.value = defaults.datasetRepoId;
        fire();
      });

    panelEl
      .querySelector('[data-action="clear"]')
      .addEventListener("click", () => {
        safeDel(LS_KEY_TELEOP);
        safeDel(LS_KEY_ROBOT);
        safeDel(LS_KEY_DATASET_ROOT);
        safeDel(LS_KEY_DATASET_REPO);
      });

    refreshDerived();
  }

  // ---------- Apply replacements ----------
  function applyToCodeNodes(codeNodes, cfg, defaults) {
    const parsedRepo = parseRepoId(cfg.datasetRepoId);

    // dataset dir (normal) + eval dataset dir
    const datasetDir = joinDatasetDir(cfg.datasetRoot, cfg.datasetRepoId);
    const datasetSlug = parsedRepo?.name || "";

    const evalDatasetSlug = datasetSlug ? evalSlugFromSlug(datasetSlug) : "";
    const evalDatasetRepoId =
      parsedRepo && evalDatasetSlug ? `${parsedRepo.owner}/${evalDatasetSlug}` : "";
    const evalDatasetDir =
      evalDatasetRepoId ? joinDatasetDir(cfg.datasetRoot, evalDatasetRepoId) : "";

    const workspaceDir = parentDir(cfg.datasetRoot);

    // models / outputs
    const trainRunName = deriveTrainRunName(defaults, datasetSlug);
    const trainOutputDir = deriveTrainOutputDir(defaults, trainRunName);
    const trainConfigPath = buildTrainConfigPath(trainOutputDir);
    const policyPath = buildPolicyPath(trainOutputDir);

    for (const code of codeNodes) {
      if (!code.dataset.lerobotTemplate) {
        code.dataset.lerobotTemplate = code.textContent || "";
      }
      let out = code.dataset.lerobotTemplate;

      // 1) Placeholder replacement (recommended)
      out = replaceAllString(out, "{{TELEOP_PORT}}", cfg.teleop);
      out = replaceAllString(out, "{{ROBOT_PORT}}", cfg.robot);

      // For backward-compatibility: DATASET_ROOT is the base dir (datasets base)
      out = replaceAllString(out, "{{DATASET_ROOT}}", cfg.datasetRoot);

      out = replaceAllString(out, "{{DATASET_REPO_ID}}", cfg.datasetRepoId);
      out = replaceAllString(out, "{{DATASET_DIR}}", datasetDir);
      out = replaceAllString(out, "{{DATASET_SLUG}}", datasetSlug);
      out = replaceAllString(out, "{{WORKSPACE_DIR}}", workspaceDir);

      // Train / resume paths
      out = replaceAllString(out, "{{TRAIN_RUN_NAME}}", trainRunName);
      out = replaceAllString(out, "{{TRAIN_OUTPUT_DIR}}", trainOutputDir);
      out = replaceAllString(out, "{{TRAIN_CONFIG_PATH}}", trainConfigPath);
      out = replaceAllString(out, "{{POLICY_PATH}}", policyPath);

      // Eval dataset (for inference)
      out = replaceAllString(out, "{{EVAL_DATASET_REPO_ID}}", evalDatasetRepoId);
      out = replaceAllString(out, "{{EVAL_DATASET_DIR}}", evalDatasetDir);
      out = replaceAllString(out, "{{EVAL_DATASET_SLUG}}", evalDatasetSlug);

      // 2) Option replacement (works even without placeholders)
      out = out.replace(RE_TELEOP_EQ, `$1${cfg.teleop}`);
      out = out.replace(RE_TELEOP_SP, `$1${cfg.teleop}`);
      out = out.replace(RE_ROBOT_EQ, `$1${cfg.robot}`);
      out = out.replace(RE_ROBOT_SP, `$1${cfg.robot}`);

      // dataset.repo_id:
      // - normal blocks -> cfg.datasetRepoId
      // - eval blocks -> <owner>/eval_<slug>
      const chooseRepoId = (currentValue) => {
        if (isEvalRepoId(currentValue)) {
          return evalDatasetRepoId || cfg.datasetRepoId;
        }
        return cfg.datasetRepoId;
      };

      out = out.replace(RE_DSET_REPO_EQ, (m, prefix, value) => {
        return `${prefix}${chooseRepoId(value)}`;
      });
      out = out.replace(RE_DSET_REPO_SP, (m, prefix, value) => {
        return `${prefix}${chooseRepoId(value)}`;
      });

      // dataset.root:
      // - normal blocks -> datasetDir
      // - eval blocks -> evalDatasetDir
      const chooseDatasetRootValue = (currentValue) => {
        if (isEvalDatasetRootPath(currentValue) || isEvalRepoId(currentValue)) {
          return evalDatasetDir || datasetDir || cfg.datasetRoot;
        }
        return datasetDir || cfg.datasetRoot;
      };

      out = out.replace(RE_DSET_ROOT_EQ, (m, prefix, value) => {
        return `${prefix}${chooseDatasetRootValue(value)}`;
      });
      out = out.replace(RE_DSET_ROOT_SP, (m, prefix, value) => {
        return `${prefix}${chooseDatasetRootValue(value)}`;
      });

      // Hydra dataset.path should point to the dataset dir
      if (datasetDir) {
        out = out.replace(RE_DATASET_PATH_EQ, `$1${datasetDir}`);
        out = out.replace(RE_DATASET_PATH_SP, `$1${datasetDir}`);
      }

      // Train-related options
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

      // 3) Replace full dataset dir occurrences from the original doc (e.g. rm -rf .../datasets/local/xxx)
      if (defaults.datasetDir && datasetDir) {
        out = replaceAllString(out, defaults.datasetDir, datasetDir);
      }

      // 3.5) Train output dir / run name replacements (学習(新規/継続)・推論のパス)
      if (defaults.trainOutputDir && trainOutputDir) {
        out = replaceAllString(out, defaults.trainOutputDir, trainOutputDir);
      }
      if (defaults.trainRunName && trainRunName) {
        out = replaceAllString(out, defaults.trainRunName, trainRunName);
      }

      // 4) Targeted rm -rf rewrite
      if (defaults.datasetRoot && datasetDir) {
        const originalBase = normalizePath(defaults.datasetRoot);
        out = out.replace(RE_RM_RF, (m, prefix, path) => {
          const p = normalizePath(path);

          // Only rewrite paths under the original datasets base dir
          if (originalBase && p.startsWith(originalBase + "/")) {
            const base = p.split("/").pop() || "";
            const isEval = base.startsWith("eval_") || base.endsWith("_eval");
            if (isEval && evalDatasetDir) return prefix + evalDatasetDir;
            return prefix + datasetDir;
          }
          return m;
        });
      }

      // 5) cd <path> rewrite
      // - If doc has "cd <datasets base>", rewrite it to workspaceDir (project root)
      // - If doc has "cd <workspaceDir>", keep it in sync.
      // - If doc has "cd <datasetDir>", keep it in sync too.
      const originalBase = defaults.datasetRoot ? normalizePath(defaults.datasetRoot) : "";
      const originalWs = defaults.workspaceDir
        ? normalizePath(defaults.workspaceDir)
        : parentDir(originalBase);
      const originalDir = defaults.datasetDir ? normalizePath(defaults.datasetDir) : "";

      out = out.replace(RE_CD_LINE, (m, prefix, path, suffix) => {
        const p = normalizePath(path);

        // dataset dir
        if (originalDir && datasetDir && p === originalDir) {
          return `${prefix}${datasetDir}${suffix}`;
        }

        // workspace dir (preferred)
        if (originalWs && workspaceDir && p === originalWs) {
          return `${prefix}${workspaceDir}${suffix}`;
        }

        // datasets base dir written in doc -> rewrite to workspace dir
        if (originalBase && workspaceDir && p === originalBase) {
          return `${prefix}${workspaceDir}${suffix}`;
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

    // Limit the scope to the current article/page to avoid touching navigation etc.
    const scope = panel.closest("article") || panel.closest("main") || root;

    const codeBlocks = collectCodeBlocks(scope);
    const inlineCodes = collectInlineCode(scope);
    const codeNodes = [...codeBlocks, ...inlineCodes];

    const defaults = guessDefaultsFromDoc(codeNodes);

    // State from localStorage (accept old stored values too)
    let savedDatasetRoot = safeGet(LS_KEY_DATASET_ROOT) || defaults.datasetRoot;
    let savedDatasetRepo = safeGet(LS_KEY_DATASET_REPO) || defaults.datasetRepoId;

    savedDatasetRepo = normalizeRepoId(savedDatasetRepo);
    savedDatasetRoot = inferDatasetBaseDirFromInput(
      normalizePath(savedDatasetRoot),
      savedDatasetRepo
    );

    const state = {
      teleop: safeGet(LS_KEY_TELEOP) || defaults.teleop,
      robot: safeGet(LS_KEY_ROBOT) || defaults.robot,
      datasetRoot: savedDatasetRoot,
      datasetRepoId: savedDatasetRepo
    };

    renderPanel(panel, state, defaults, ({ teleop, robot, datasetRoot, datasetRepoId }) => {
      safeSet(LS_KEY_TELEOP, teleop);
      safeSet(LS_KEY_ROBOT, robot);
      safeSet(LS_KEY_DATASET_ROOT, datasetRoot);
      safeSet(LS_KEY_DATASET_REPO, datasetRepoId);

      applyToCodeNodes(codeNodes, { teleop, robot, datasetRoot, datasetRepoId }, defaults);
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
