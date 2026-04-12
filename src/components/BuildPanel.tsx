import { useEffect, useRef, useState } from "react";
import {
  Play, CheckCircle, XCircle, Loader2, Terminal, Cpu, Info,
  ImageIcon, Trash2,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { buildGame, onBuildLog, onBuildProgress, readFileAsDataUrl } from "../lib/tauri";
import type { Platform, BuildProgress } from "../types";
import { useT } from "../i18n/useT";

const PLATFORM_LABELS: Record<Platform, string> = {
  windows: "🪟 Windows",
  macos:   "🍎 macOS",
  linux:   "🐧 Linux",
  android: "📦 Android",
  ios:     "📱 iOS",
};

export default function BuildPanel() {
  const {
    project, cachedRuntimes, isBuilding,
    buildProgressList, setBuildProgressList,
    setIsBuilding, updateProject, updateBuildProgress,
    buildLogs, addBuildLog, clearBuildLogs,
    settings,
  } = useAppStore();
  const t = useT();

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unlisten = onBuildLog((msg) => { addBuildLog(msg); });
    return () => { unlisten.then((fn) => fn()); };
  }, [addBuildLog]);

  useEffect(() => {
    const unlisten = onBuildProgress(({ platform, status, message }) => {
      updateBuildProgress(platform as Platform, { status: status as BuildProgress["status"], message });
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [updateBuildProgress]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [buildLogs]);

  const enabledTargets = project.targets.filter((t2) => t2.enabled);

  function canBuild() {
    return (
      !isBuilding &&
      project.name.trim() !== "" &&
      project.sourcePath !== "" &&
      project.love2dVersion !== "" &&
      enabledTargets.length > 0
    );
  }

  async function handleBuild() {
    clearBuildLogs();
    setIsBuilding(true);
    setBuildProgressList(
      enabledTargets.map((tgt) => ({
        platform: tgt.platform,
        status: "pending",
        message: t("build.log_waiting"),
        percent: 0,
      }))
    );
    try {
      await buildGame(
        project,
        settings.runtimeDir || undefined,
        settings.defaultOutputDir || undefined,
        settings.androidSdkDir || undefined,
        settings.jdk17Dir || undefined,
        settings.keystorePath || undefined,
        settings.keystorePassword || undefined,
        settings.keystoreKeyAlias || undefined,
        settings.keystoreKeyPassword || undefined,
      );
    } catch (e) {
      addBuildLog(`[ERROR] ${e}`);
    } finally {
      setIsBuilding(false);
    }
  }

  function runtimeAvailable(platform: Platform) {
    const checkPlatform = platform === "android" ? "android-template" : platform;
    return cachedRuntimes.some(
      (c) => c.version === project.love2dVersion && c.platform === checkPlatform
    );
  }

  const missingRuntimes = enabledTargets.filter((tgt) => !runtimeAvailable(tgt.platform));
  const buildDisabledReason = !project.name.trim()
    ? t("build.warn_name")
    : !project.sourcePath
    ? t("build.warn_source")
    : !project.love2dVersion
    ? t("build.warn_version")
    : enabledTargets.length === 0
    ? t("build.warn_no_target")
    : missingRuntimes.length > 0
    ? t("build.warn_missing_runtime", { platforms: missingRuntimes.map((tgt) => tgt.platform).join(", ") })
    : null;

  const basePath = settings.defaultOutputDir || "%APPDATA%/love2dhub/builds";
  const outputDirHint = `${basePath}/{game}/{platform}/`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6 gap-5">
      <div className="flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e8e8e8]">{t("build.title")}</h2>
        <p className="text-sm text-gray-500 dark:text-[#909090] mt-0.5">{t("build.subtitle")}</p>
      </div>

      {/* 项目信息摘要 */}
      <ProjectInfoBar />

      <div className="flex gap-5 flex-1 overflow-hidden min-h-0">
        {/* 左栏：配置 */}
        <div className="w-72 flex-shrink-0 space-y-4 overflow-y-auto">

          {/* 运行时版本选择 */}
          <div className="card p-4">
            <p className="section-title">{t("build.section_version")}</p>
            {cachedRuntimes.length === 0 ? (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                {t("build.no_runtimes_warn")}
              </p>
            ) : (
              <select
                value={project.love2dVersion}
                onChange={(e) => updateProject({ love2dVersion: e.target.value })}
                className="input"
              >
                <option value="">{t("build.select_version")}</option>
                {[...new Set(cachedRuntimes.map((c) => c.version))].sort((a, b) =>
                  b.localeCompare(a, undefined, { numeric: true })
                ).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            )}
          </div>

          {/* LuaJIT 字节码编译 */}
          <div className="card p-4">
            <p className="section-title">{t("build.section_compile")}</p>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={project.compileLua}
                onChange={(e) => updateProject({ compileLua: e.target.checked })}
                className="accent-pink-500 mt-0.5 w-4 h-4 flex-shrink-0"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <Cpu size={14} className="text-pink-500" />
                  <span className="text-sm font-medium text-gray-800">{t("build.luajit_title")}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {t("build.luajit_desc")}
                </p>
                {project.compileLua && (
                  <div className="flex items-start gap-1 mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2">
                    <Info size={11} className="flex-shrink-0 mt-0.5" />
                    <span>{t("build.luajit_info")}</span>
                  </div>
                )}
              </div>
            </label>
          </div>

          {/* 目标平台状态 */}
          <div className="card p-4">
            <p className="section-title">{t("build.section_targets")}</p>
            {enabledTargets.length === 0 ? (
              <p className="text-xs text-gray-400">{t("build.no_targets")}</p>
            ) : (
              <div className="space-y-2.5">
                {enabledTargets.map((target) => {
                  const prog = buildProgressList.find((p) => p.platform === target.platform);
                  const available = runtimeAvailable(target.platform);
                  return (
                    <div key={target.platform} className="flex items-center gap-2">
                      <StatusDot status={prog?.status ?? (available ? "ready" : "missing")} />
                      <span className="text-sm font-medium text-gray-700 flex-1">
                        {PLATFORM_LABELS[target.platform]}
                      </span>
                      {prog ? (
                        <span className="text-xs text-gray-400">{prog.message}</span>
                      ) : (
                        <span className={`text-xs ${available ? "text-green-500" : "text-red-400"}`}>
                          {available ? t("build.target_ready") : t("build.target_missing")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 导出位置说明 */}
          <div className="card p-4 bg-blue-50 border border-blue-100">
            <p className="section-title text-blue-600">{t("build.section_output")}</p>
            <p className="text-xs text-blue-700 break-all">{outputDirHint}</p>
            <p className="text-xs text-blue-400 mt-1">{t("build.output_hint")}</p>
          </div>

          {/* 开始按钮 */}
          <button
            onClick={handleBuild}
            disabled={!canBuild()}
            className="btn-primary w-full py-3 text-base"
            title={buildDisabledReason ?? ""}
          >
            {isBuilding ? (
              <><Loader2 size={17} className="animate-spin" />{t("build.building")}</>
            ) : (
              <><Play size={17} fill="currentColor" />{t("build.start")}</>
            )}
          </button>

          {buildDisabledReason && !isBuilding && (
            <p className="text-xs text-amber-600 text-center -mt-2">{buildDisabledReason}</p>
          )}
        </div>

        {/* 右栏：日志 */}
        <div className="flex-1 card flex flex-col overflow-hidden min-h-0">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 flex-shrink-0">
            <Terminal size={14} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-600 flex-1">{t("build.log_title")}</span>
            {buildLogs.length > 0 && (
              <button
                onClick={clearBuildLogs}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-50"
              >
                <Trash2 size={12} />
                {t("build.log_clear")}
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-0.5 bg-gray-50 select-text cursor-text">
            {buildLogs.length === 0 ? (
              <div className="text-gray-400">{t("build.log_waiting")}</div>
            ) : (
              buildLogs.map((msg, i) => (
                <div
                  key={i}
                  className={
                    msg.startsWith("[ERROR]") ? "text-red-500" :
                    msg.startsWith("[OK]")    ? "text-green-600" :
                    msg.startsWith("[WARN]")  ? "text-amber-500" :
                    "text-gray-700"
                  }
                >
                  {msg}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 项目信息摘要条 ────────────────────────────────────────

function ProjectInfoBar() {
  const { project } = useAppStore();
  const t = useT();
  const [iconDataUrl, setIconDataUrl] = useState<string | null>(null);
  const hasIcon = project.iconPath.trim() !== "";
  const isReady = project.name.trim() !== "" && project.sourcePath !== "";

  useEffect(() => {
    if (!hasIcon) { setIconDataUrl(null); return; }
    readFileAsDataUrl(project.iconPath)
      .then(setIconDataUrl)
      .catch(() => setIconDataUrl(null));
  }, [project.iconPath, hasIcon]);

  if (!isReady) {
    return (
      <div className="flex-shrink-0 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
        <Info size={14} className="text-amber-500 flex-shrink-0" />
        <span className="text-xs text-amber-600">{t("build.info_missing")}</span>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 card px-4 py-3 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {hasIcon && iconDataUrl ? (
          <img src={iconDataUrl} alt="icon" className="w-10 h-10 object-cover rounded-lg" />
        ) : (
          <ImageIcon size={18} className="text-pink-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 truncate">{project.name}</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
            v{project.version}
          </span>
          {project.author && (
            <span className="text-xs text-gray-400 flex-shrink-0">by {project.author}</span>
          )}
        </div>
        <div className="text-xs text-gray-400 truncate mt-0.5">{project.sourcePath}</div>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        {project.targets.filter(tgt => tgt.enabled).map(tgt => (
          <span key={tgt.platform} className="text-xs bg-pink-50 text-pink-500 border border-pink-200 px-2 py-0.5 rounded-full">
            {tgt.platform}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── StatusDot ─────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  if (status === "success") return <CheckCircle size={14} className="text-green-500" />;
  if (status === "error")   return <XCircle size={14} className="text-red-500" />;
  if (status === "running") return <Loader2 size={14} className="animate-spin text-pink-500" />;
  if (status === "missing") return <div className="w-3.5 h-3.5 rounded-full bg-red-200 border border-red-300" />;
  return <div className="w-3.5 h-3.5 rounded-full bg-green-200 border border-green-300" />;
}
