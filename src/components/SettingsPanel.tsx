import { useEffect, useState } from "react";
import {
  FolderOpen, RotateCcw, HardDrive, FolderOutput, Info,
  Smartphone, Sun, Moon, Monitor, ExternalLink, KeyRound, Languages,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { openFolderDialog, getDefaultDirs, openPath } from "../lib/tauri";
import { useT } from "../i18n/useT";

export default function SettingsPanel() {
  const { settings, setSettings } = useAppStore();
  const t = useT();
  const [defaultRuntimeDir, setDefaultRuntimeDir] = useState("");
  const [defaultBuildDir, setDefaultBuildDir] = useState("");

  useEffect(() => {
    getDefaultDirs().then(({ runtimeDir, buildDir }) => {
      setDefaultRuntimeDir(runtimeDir);
      setDefaultBuildDir(buildDir);
    });
  }, []);

  async function pickDir(key: keyof typeof settings) {
    const path = await openFolderDialog();
    if (path) setSettings({ [key]: path } as any);
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e8e8e8]">{t("settings.title")}</h2>
          <p className="text-sm text-gray-500 dark:text-[#909090] mt-0.5">{t("settings.subtitle")}</p>
        </div>

        {/* 外观 */}
        <div className="card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Sun size={18} className="text-pink-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-gray-900 dark:text-[#e8e8e8]">{t("settings.section_theme")}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t("settings.theme_desc")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {(["light", "dark", "system"] as const).map((theme) => {
              const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
              const label = theme === "light" ? t("settings.theme_light") : theme === "dark" ? t("settings.theme_dark") : t("settings.theme_system");
              const active = settings.theme === theme;
              return (
                <button
                  key={theme}
                  type="button"
                  onClick={() => setSettings({ theme })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-all ${
                    active
                      ? "border-pink-400 bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-[#2a2a2a] dark:text-[#909090] dark:hover:bg-[#252525]"
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 语言 */}
        <div className="card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Languages size={18} className="text-pink-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-gray-900 dark:text-[#e8e8e8]">{t("settings.section_language")}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t("settings.language_desc")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {(["zh-CN", "en"] as const).map((lang) => {
              const active = (settings.language ?? "zh-CN") === lang;
              const label = lang === "zh-CN" ? "中文" : "English";
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setSettings({ language: lang })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-all ${
                    active
                      ? "border-pink-400 bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-[#2a2a2a] dark:text-[#909090] dark:hover:bg-[#252525]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 启动行为 */}
        <div className="card p-5">
          <p className="font-semibold text-gray-900 dark:text-[#e8e8e8] mb-3">{t("settings.section_startup")}</p>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.openSettingsOnStartup}
              onChange={(e) => setSettings({ openSettingsOnStartup: e.target.checked })}
              className="accent-pink-500 w-4 h-4 flex-shrink-0"
            />
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-[#c0c0c0]">{t("settings.startup_label")}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t("settings.startup_desc")}</p>
            </div>
          </label>
        </div>

        {/* 运行时目录 */}
        <div className="card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <HardDrive size={18} className="text-pink-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900 dark:text-[#e8e8e8]">{t("settings.section_runtime_dir")}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t("settings.runtime_dir_desc")}</p>
            </div>
          </div>
          <DirPicker
            value={settings.runtimeDir}
            defaultOpenPath={defaultRuntimeDir}
            placeholder={defaultRuntimeDir || t("settings.runtime_dir_placeholder")}
            onPick={() => pickDir("runtimeDir")}
            onClear={() => setSettings({ runtimeDir: "" })}
            onChange={(v) => setSettings({ runtimeDir: v })}
          />
        </div>

        {/* 导出目录 */}
        <div className="card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <FolderOutput size={18} className="text-pink-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900 dark:text-[#e8e8e8]">{t("settings.section_output_dir")}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t("settings.output_dir_desc")}</p>
            </div>
          </div>
          <DirPicker
            value={settings.defaultOutputDir}
            defaultOpenPath={defaultBuildDir}
            placeholder={defaultBuildDir || t("settings.output_dir_placeholder")}
            onPick={() => pickDir("defaultOutputDir")}
            onClear={() => setSettings({ defaultOutputDir: "" })}
            onChange={(v) => setSettings({ defaultOutputDir: v })}
          />
        </div>

        {/* Android 构建环境 */}
        <div className="card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Smartphone size={18} className="text-pink-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900 dark:text-[#e8e8e8]">{t("settings.section_android_env")}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t("settings.android_env_desc")}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-600 dark:text-[#909090]">
                {t("settings.sdk_dir_label")} <span className="text-pink-500">*</span>
              </p>
              <DirPicker
                value={settings.androidSdkDir}
                defaultOpenPath=""
                placeholder={t("settings.sdk_dir_placeholder")}
                onPick={() => pickDir("androidSdkDir")}
                onClear={() => setSettings({ androidSdkDir: "" })}
                onChange={(v) => setSettings({ androidSdkDir: v })}
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-600 dark:text-[#909090]">{t("settings.jdk_dir_label")}</p>
              <DirPicker
                value={settings.jdk17Dir}
                defaultOpenPath=""
                placeholder={t("settings.jdk_dir_placeholder")}
                onPick={() => pickDir("jdk17Dir")}
                onClear={() => setSettings({ jdk17Dir: "" })}
                onChange={(v) => setSettings({ jdk17Dir: v })}
              />
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            <Info size={12} className="flex-shrink-0 mt-0.5" />
            <span>{t("settings.android_warn")}</span>
          </div>
        </div>

        {/* Android 签名 */}
        <div className="card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <KeyRound size={18} className="text-pink-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900 dark:text-[#e8e8e8]">{t("settings.section_android_sign")}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t("settings.android_sign_desc")}</p>
            </div>
          </div>

          {/* Build Mode Toggle */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600 dark:text-[#909090]">{t("settings.build_mode_label")}</p>
            <div className="flex gap-2">
              {(["debug", "release"] as const).map((mode) => {
                const active = (settings.androidBuildMode ?? "debug") === mode;
                const label = mode === "debug" ? t("settings.build_mode_debug") : t("settings.build_mode_release");
                const desc  = mode === "debug" ? t("settings.build_mode_debug_desc") : t("settings.build_mode_release_desc");
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSettings({ androidBuildMode: mode })}
                    className={`flex-1 flex flex-col items-center py-2.5 px-3 rounded-lg border text-sm font-medium transition-all ${
                      active
                        ? "border-pink-400 bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400"
                        : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-[#2a2a2a] dark:text-[#909090] dark:hover:bg-[#252525]"
                    }`}
                  >
                    <span>{label}</span>
                    <span className={`text-xs font-normal mt-0.5 ${active ? "text-pink-400" : "text-gray-400"}`}>{desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-600 dark:text-[#909090]">{t("settings.keystore_file")}</p>
              <FilePicker
                value={settings.keystorePath}
                placeholder={t("settings.keystore_placeholder")}
                onPick={async () => {
                  const { open } = await import("@tauri-apps/plugin-dialog");
                  const p = await open({ filters: [{ name: "Keystore", extensions: ["jks", "keystore"] }] });
                  if (p) setSettings({ keystorePath: p as string });
                }}
                onClear={() => setSettings({ keystorePath: "" })}
                onChange={(v) => setSettings({ keystorePath: v })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-gray-600 dark:text-[#909090]">{t("settings.key_alias")}</p>
                <input
                  type="text"
                  className="input"
                  value={settings.keystoreKeyAlias}
                  placeholder={t("settings.key_alias_placeholder")}
                  onChange={(e) => setSettings({ keystoreKeyAlias: e.target.value })}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-gray-600 dark:text-[#909090]">{t("settings.keystore_password")}</p>
                <input
                  type="password"
                  className="input"
                  value={settings.keystorePassword}
                  placeholder={t("settings.keystore_password")}
                  onChange={(e) => setSettings({ keystorePassword: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <p className="text-xs font-medium text-gray-600 dark:text-[#909090]">
                  {t("settings.key_password")}
                  <span className="text-gray-400 font-normal ml-1">— {t("settings.key_password_hint")}</span>
                </p>
                <input
                  type="password"
                  className="input"
                  value={settings.keystoreKeyPassword}
                  placeholder={t("settings.key_password_hint")}
                  onChange={(e) => setSettings({ keystoreKeyPassword: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 重置 */}
        <div className="card p-5">
          <p className="font-semibold text-gray-900 dark:text-[#e8e8e8] mb-3">{t("settings.section_reset")}</p>
          <button
            onClick={() => {
              if (confirm(t("settings.reset_confirm"))) {
                setSettings({
                  runtimeDir: "", defaultOutputDir: "",
                  androidSdkDir: "", jdk17Dir: "",
                  keystorePath: "", keystorePassword: "",
                  keystoreKeyAlias: "", keystoreKeyPassword: "",
                  theme: "system", openSettingsOnStartup: false,
                  androidBuildMode: "debug",
                });
              }
            }}
            className="btn-ghost border border-red-200 text-red-500 hover:bg-red-50"
          >
            <RotateCcw size={14} />
            {t("common.reset")}
          </button>
        </div>

      </div>
    </div>
  );
}

// ── 目录选择器 ──────────────────────────────────────────────

function DirPicker({
  value, defaultOpenPath, placeholder, onPick, onClear, onChange,
}: {
  value: string; defaultOpenPath: string; placeholder: string;
  onPick: () => void; onClear: () => void; onChange: (v: string) => void;
}) {
  const t = useT();
  const hasValue = value.trim() !== "";
  const openTarget = hasValue ? value : defaultOpenPath;

  return (
    <div className="flex gap-2">
      <input
        type="text"
        className={`input flex-1 ${hasValue ? "border-green-300 focus:border-green-400" : ""}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoComplete="off"
      />
      <button type="button" onClick={onPick}
        className="btn-ghost border border-gray-200 bg-white dark:bg-slate-700 flex-shrink-0">
        <FolderOpen size={14} className="text-gray-500" />
        {t("common.browse")}
      </button>
      <button type="button" onClick={() => openPath(openTarget).catch(() => {})}
        disabled={!openTarget}
        className="px-3 text-gray-400 hover:text-blue-500 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
        title={hasValue ? "Open in Explorer" : "Open default dir"}>
        <ExternalLink size={14} />
      </button>
      {hasValue && (
        <button type="button" onClick={onClear}
          className="px-3 text-gray-400 hover:text-red-400 border border-gray-200 rounded-lg hover:border-red-200 transition-colors flex-shrink-0"
          title={t("common.clear")}>
          ✕
        </button>
      )}
    </div>
  );
}

// ── 文件选择器（用于 keystore）──────────────────────────────

function FilePicker({
  value, placeholder, onPick, onClear, onChange,
}: {
  value: string; placeholder: string;
  onPick: () => void; onClear: () => void; onChange: (v: string) => void;
}) {
  const t = useT();
  const hasValue = value.trim() !== "";
  return (
    <div className="flex gap-2">
      <input
        type="text"
        className={`input flex-1 ${hasValue ? "border-green-300 focus:border-green-400" : ""}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoComplete="off"
      />
      <button type="button" onClick={onPick}
        className="btn-ghost border border-gray-200 bg-white dark:bg-slate-700 flex-shrink-0">
        <FolderOpen size={14} className="text-gray-500" />
        {t("common.browse")}
      </button>
      {hasValue && (
        <button type="button" onClick={onClear}
          className="px-3 text-gray-400 hover:text-red-400 border border-gray-200 rounded-lg hover:border-red-200 transition-colors flex-shrink-0"
          title={t("common.clear")}>
          ✕
        </button>
      )}
    </div>
  );
}
