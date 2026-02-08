(() => {
  "use strict";

  // ---------- LocalStorage keys ----------
  const LS_KEY_TELEOP = "lerobot.teleop_port";
  const LS_KEY_ROBOT = "lerobot.robot_port";
  const LS_KEY_DATASET_ROOT = "lerobot.dataset_root";
  const LS_KEY_DATASET_REPO = "lerobot.dataset_repo_id";

  // ---------- Replace targets (support "=value" and " value") ----------
  const RE_TELEOP_EQ = /(--teleop\.port=)(\S+)/g;
  const RE_TELEOP_SP = /(--teleop\.port\s+)(\S+)/g;
  const RE_ROBOT_EQ = /(--robot\.port=)(\S+)/g;
  const RE_ROBOT_SP = /(--robot\.port\s+)(\S+)/g;

  const RE_DSET_ROOT_EQ = /(--dataset\.root=)(\S+)/g;
  const RE_DSET_ROOT_SP = /(--dataset\.root\s+)(\S+)/g;
  const RE_DSET_REPO_EQ = /(--dataset\.repo_id=)(\S+)/g;
  const RE_DSET_REPO_SP = /(--dataset\.repo_id\s+)(\S+)/g;

  // Hydra style (train)
  const RE_DATASET_PATH_EQ = /(dataset\.path=)(\S+)/g;
  const RE_DATASET_PATH_SP = /(dataset\.path\s+)(\S+)/g;

  // Optional: rm -rf <path>
  const RE_RM_RF = /(rm\s+-rf\s+)(\S+)/g;

  // Optional: cd <path> (single line)
  const RE_CD_LINE = /^(\s*cd\s+)(\S+)(\s*)$/gm;

  // For guessing defaults from the document
  const RE_FIND_TELEOP = /--teleop\.port(?:=|\s+)(\S+)/;
  const RE_FIND_ROBOT = /--robot\.port(?:=|\s+)(\S+)/;
  const RE_FIND_DSET_ROOT = /--dataset\.root(?:=|\s+)(\S+)/;
  const RE_FIND_DSET_REPO = /--dataset\.repo_id(?:=|\s+)(\S+)/;

  // For guessing train-related defaults (output_dir / resume)
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
    // Inline code like `outputs/train/.../train_config.json`
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

  function joinDatasetDir(datasetRoot, datasetRepoId) {
    const root = normalizePath(datasetRoot);
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

  function deriveTrainOutputDir(defaults, trainRunName) {
    const baseDir = String(defaults.trainOutputDir || "").trim();
    const run = String(trainRunName || "").trim();
    if (!run) return baseDir;

    // If we have a base dir, rewrite the run segment under outputs/train.
    if (baseDir) {
      // Replace "outputs/train/<something>" -> "outputs/train/<run>"
      return baseDir.replace(/(outputs\/train\/)([^\/\s]+)/, `$1${run}`);
    }

    return `outputs/train/${run}`;
  }

  // ---------- Defaults from doc ----------
  function guessDefaultsFromDoc(codeNodes) {
    let teleop = "";
    let robot = "";
    let datasetRoot = "";
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
      if (!datasetRoot) {
        const m = t.match(RE_FIND_DSET_ROOT);
        if (m && m[1]) datasetRoot = m[1];
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

      if (teleop && robot && datasetRoot && datasetRepoId && policyType && trainOutputDir && trainRunName) break;
    }

    // Fallbacks (only used if doc doesn't contain them)
    if (!teleop) teleop = "/dev/ttyACM1";
    if (!robot) robot = "/dev/ttyACM0";
    if (!datasetRoot)
      datasetRoot = "/home/jetson/lerobot/datasets";
    if (!datasetRepoId) datasetRepoId = "local/1cam_test";

    if (!policyType) policyType = "act";

    datasetRoot = normalizePath(datasetRoot);
    datasetRepoId = normalizeRepoId(datasetRepoId);

    const datasetDir = joinDatasetDir(datasetRoot, datasetRepoId);
    const slug = parseRepoId(datasetRepoId)?.name || "";
    const workspaceDir = parentDir(datasetRoot);

    // Train output defaults (if doc didn't contain them)
    if (!trainRunName && policyType && slug) {
      trainRunName = `${policyType}_${slug}`;
    }
    if (!trainOutputDir && trainRunName) {
      trainOutputDir = `outputs/train/${trainRunName}`;
    }

    return {
      teleop,
      robot,
      datasetRoot,
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
          <label class="lerobot-port-label" for="lerobot-dataset-root">dataset.root（datasets保存先）</label>
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
          <label class="lerobot-port-label" for="lerobot-dataset-repo">dataset.repo_id（owner/name）</label>
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
          <div class="lerobot-port-label">workspace dir（dataset.rootの親）</div>
          <div class="lerobot-port-derived">
            <code id="lerobot-workspace-dir"></code>
          </div>
        </div>

        <div class="lerobot-port-row lerobot-port-row--derived">
          <div class="lerobot-port-label">dataset dir（root + repo）</div>
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

        <div class="lerobot-port-actions">
          <button type="button" class="lerobot-port-btn" data-action="reset">初期値に戻す</button>
          <button type="button" class="lerobot-port-btn" data-action="clear">保存を消す</button>
        </div>

        <div class="lerobot-port-hint">
          入力すると、このページ内のコードブロックに含まれる
          <code>--teleop.port</code> / <code>--robot.port</code> /
          <code>--dataset.root</code> / <code>--dataset.repo_id</code> /
          <code>dataset.path=</code> /
          <code>rm -rf ...</code>（dataset.root配下） /
          <code>cd ...</code>（作業フォルダ用）
          / <code>--output_dir</code> / <code>--job_name</code> /
          <code>outputs/train/.../</code>（学習/推論のパス）
          を一括で差し替えます（localStorageに保存）。
          <br />
          さらに、<code>{{TELEOP_PORT}}</code>, <code>{{ROBOT_PORT}}</code>,
          <code>{{DATASET_ROOT}}</code>, <code>{{DATASET_REPO_ID}}</code>,
          <code>{{DATASET_DIR}}</code>, <code>{{DATASET_SLUG}}</code>,
          <code>{{WORKSPACE_DIR}}</code>,
          <code>{{TRAIN_RUN_NAME}}</code>, <code>{{TRAIN_OUTPUT_DIR}}</code>,
          <code>{{TRAIN_CONFIG_PATH}}</code>, <code>{{POLICY_PATH}}</code>,
          <code>{{EVAL_DATASET_REPO_ID}}</code>, <code>{{EVAL_DATASET_DIR}}</code>,
          <code>{{EVAL_DATASET_SLUG}}</code> のプレースホルダも置換します。
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

    function refreshDerived() {
      const root = normalizePath(dsRootInput.value || defaults.datasetRoot);
      const repo = normalizeRepoId(dsRepoInput.value || defaults.datasetRepoId);
      const parsed = parseRepoId(repo);

      const workspaceDir = parentDir(root);
      wsDirEl.textContent = workspaceDir || "(parent dir が取れません)";

      if (!root) {
        dsDirEl.textContent = "";
      } else if (parsed) {
        dsDirEl.textContent = `${root}/${parsed.owner}/${parsed.name}`;
      } else {
        dsDirEl.textContent = "(repo_id が不正です)";
      }

      // Eval dataset (for inference): <owner>/eval_<slug>
      if (evalRepoEl && evalDirEl) {
        if (parsed) {
          const evalSlug = evalSlugFromSlug(parsed.name);
          const evalRepoId = `${parsed.owner}/${evalSlug}`;
          evalRepoEl.textContent = evalRepoId;
          evalDirEl.textContent = root ? `${root}/${parsed.owner}/${evalSlug}` : "";
        } else {
          evalRepoEl.textContent = "";
          evalDirEl.textContent = "";
        }
      }

      if (!parsed) {
        warnEl.style.display = "block";
        warnEl.textContent = "repo_id は owner/name 形式にしてください（例: akira/1cam_test）";
      } else {
        warnEl.style.display = "none";
        warnEl.textContent = "";
      }
    }

    const fire = () => {
      const teleop = (teleopInput.value || "").trim() || defaults.teleop;
      const robot = (robotInput.value || "").trim() || defaults.robot;
      const datasetRoot = normalizePath(
        (dsRootInput.value || "").trim() || defaults.datasetRoot
      );
      const datasetRepoId = normalizeRepoId(
        (dsRepoInput.value || "").trim() || defaults.datasetRepoId
      );

      refreshDerived();
      onChange({ teleop, robot, datasetRoot, datasetRepoId });
    };

    teleopInput.addEventListener("input", fire);
    robotInput.addEventListener("input", fire);
    dsRootInput.addEventListener("input", fire);
    dsRepoInput.addEventListener("input", fire);

    panelEl.querySelector('[data-action="reset"]').addEventListener("click", () => {
      teleopInput.value = defaults.teleop;
      robotInput.value = defaults.robot;
      dsRootInput.value = defaults.datasetRoot;
      dsRepoInput.value = defaults.datasetRepoId;
      fire();
    });

    panelEl.querySelector('[data-action="clear"]').addEventListener("click", () => {
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
    const datasetDir = joinDatasetDir(cfg.datasetRoot, cfg.datasetRepoId);
    const datasetSlug = parsedRepo?.name || "";
    const evalDatasetSlug = datasetSlug ? evalSlugFromSlug(datasetSlug) : "";
    const evalDatasetRepoId =
      parsedRepo && evalDatasetSlug ? `${parsedRepo.owner}/${evalDatasetSlug}` : "";
    const evalDatasetDir =
      evalDatasetRepoId ? joinDatasetDir(cfg.datasetRoot, evalDatasetRepoId) : "";
    const workspaceDir = parentDir(cfg.datasetRoot);

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

      out = out.replace(RE_DSET_ROOT_EQ, `$1${cfg.datasetRoot}`);
      out = out.replace(RE_DSET_ROOT_SP, `$1${cfg.datasetRoot}`);

      // dataset.repo_id:
      // - normal blocks -> cfg.datasetRepoId
      // - eval blocks (repo name starts with "eval_" or ends with "_eval") -> <owner>/eval_<slug>
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

      if (datasetDir) {
        out = out.replace(RE_DATASET_PATH_EQ, `$1${datasetDir}`);
        out = out.replace(RE_DATASET_PATH_SP, `$1${datasetDir}`);
      }

      // 3) Replace full dataset dir occurrences from the original doc (e.g. rm -rf ...)
      if (defaults.datasetDir && datasetDir) {
        out = replaceAllString(out, defaults.datasetDir, datasetDir);
      }

      // 3.5) Train output dir / run name replacements (学習(新規/継続)・推論のパス)
      // - Update config_path / policy.path / inline path mentions too.
      if (defaults.trainOutputDir && trainOutputDir) {
        out = replaceAllString(out, defaults.trainOutputDir, trainOutputDir);
      }
      if (defaults.trainRunName && trainRunName) {
        out = replaceAllString(out, defaults.trainRunName, trainRunName);
      }

      // 4) More targeted rm -rf rewrite (only if it points under the original dataset.root)
      if (defaults.datasetRoot && datasetDir) {
        const originalRoot = normalizePath(defaults.datasetRoot);
        out = out.replace(RE_RM_RF, (m, prefix, path) => {
          const p = normalizePath(path);
          if (p.startsWith(originalRoot + "/")) {
            const base = p.split("/").pop() || "";
            const isEval = base.startsWith("eval_") || base.endsWith("_eval");

            // If the template path is an eval dataset, keep it as "eval_..."
            if (isEval && evalDatasetDir) return prefix + evalDatasetDir;

            return prefix + datasetDir;
          }
          return m;
        });
      }

      // 5) cd <path> rewrite
      // - If doc has "cd <dataset.root>", we rewrite it to workspaceDir (parent of dataset.root),
      //   because "作業フォルダ" is usually the project root.
      // - If doc has "cd <workspaceDir>", we keep it in sync.
      // - If doc has "cd <datasetDir>", we keep it in sync too.
      const originalRoot = defaults.datasetRoot ? normalizePath(defaults.datasetRoot) : "";
      const originalWs = defaults.workspaceDir ? normalizePath(defaults.workspaceDir) : parentDir(originalRoot);
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

        // dataset root written in doc -> rewrite to workspace dir
        if (originalRoot && workspaceDir && p === originalRoot) {
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

    const state = {
      teleop: safeGet(LS_KEY_TELEOP) || defaults.teleop,
      robot: safeGet(LS_KEY_ROBOT) || defaults.robot,
      datasetRoot: normalizePath(
        safeGet(LS_KEY_DATASET_ROOT) || defaults.datasetRoot
      ),
      datasetRepoId: normalizeRepoId(
        safeGet(LS_KEY_DATASET_REPO) || defaults.datasetRepoId
      )
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
