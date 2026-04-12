import { FolderOpen, ImageIcon, Info } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { openFolderDialog, openFileDialog } from "../lib/tauri";
import { useT } from "../i18n/useT";

const PLATFORMS = ["windows", "linux", "android"] as const;
const PLATFORM_ICONS: Record<string, string> = {
  windows: "🪟", linux: "🐧", android: "📦",
};

export default function ProjectConfig() {
  const { project, updateProject, toggleTarget } = useAppStore();
  const t = useT();

  async function pickSourcePath() {
    const path = await openFolderDialog();
    if (path) updateProject({ sourcePath: path });
  }

  async function pickIcon() {
    const path = await openFileDialog([
      { name: "Images", extensions: ["png", "ico", "icns"] },
    ]);
    if (path) updateProject({ iconPath: path });
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e8e8e8]">{t("project.title")}</h2>
          <p className="text-sm text-gray-500 dark:text-[#909090] mt-0.5">{t("project.subtitle")}</p>
        </div>

        {/* 基本信息 */}
        <div className="card p-5">
          <p className="section-title">{t("project.section_basic")}</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("project.name")} required>
              <input
                className="input"
                value={project.name}
                onChange={(e) => updateProject({ name: e.target.value })}
                placeholder="My Awesome Game"
              />
            </Field>
            <Field label={t("project.version")} required>
              <input
                className="input"
                value={project.version}
                onChange={(e) => updateProject({ version: e.target.value })}
                placeholder="1.0.0"
              />
            </Field>
            <Field label={t("project.author")}>
              <input
                className="input"
                value={project.author}
                onChange={(e) => updateProject({ author: e.target.value })}
                placeholder="Your Name"
              />
            </Field>
            <Field label={t("project.description")}>
              <input
                className="input"
                value={project.description}
                onChange={(e) => updateProject({ description: e.target.value })}
                placeholder="A short description"
              />
            </Field>
          </div>
        </div>

        {/* 路径配置 */}
        <div className="card p-5">
          <p className="section-title">{t("project.section_paths")}</p>
          <div className="space-y-3">
            <Field label={t("project.source_dir")} required hint={t("project.source_dir_hint")}>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  value={project.sourcePath}
                  placeholder={t("project.source_dir_placeholder")}
                  onChange={(e) => updateProject({ sourcePath: e.target.value })}
                  spellCheck={false}
                  autoComplete="off"
                />
                <button type="button" onClick={pickSourcePath} className="btn-ghost border border-gray-200 bg-white flex-shrink-0">
                  <FolderOpen size={15} className="text-gray-500" />
                  {t("common.browse")}
                </button>
              </div>
            </Field>
            <Field label={t("project.icon")} hint={t("project.icon_hint")}>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  value={project.iconPath}
                  placeholder={t("project.icon_placeholder")}
                  onChange={(e) => updateProject({ iconPath: e.target.value })}
                  spellCheck={false}
                  autoComplete="off"
                />
                <button type="button" onClick={pickIcon} className="btn-ghost border border-gray-200 bg-white flex-shrink-0">
                  <ImageIcon size={15} className="text-gray-500" />
                  {t("common.browse")}
                </button>
              </div>
            </Field>
          </div>
        </div>

        {/* Android App ID */}
        {project.targets.find((t2) => t2.platform === "android")?.enabled && (
          <div className="card p-5">
            <p className="section-title">{t("project.section_android")}</p>
            <Field label={t("project.android_app_id")} hint={t("project.android_app_id_hint")}>
              <input
                type="text"
                className="input"
                value={project.androidAppId}
                onChange={(e) => updateProject({ androidAppId: e.target.value })}
                placeholder={t("project.android_app_id_placeholder")}
                spellCheck={false}
                autoComplete="off"
              />
            </Field>
          </div>
        )}

        {/* 目标平台 */}
        <div className="card p-5">
          <p className="section-title">{t("project.section_platforms")}</p>
          <div className="grid grid-cols-2 gap-2.5">
            {PLATFORMS.map((platform) => {
              const target = project.targets.find((tgt) => tgt.platform === platform);
              const enabled = target?.enabled ?? false;

              return (
                <label
                  key={platform}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all ${
                    enabled
                      ? "border-pink-300 bg-pink-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => toggleTarget(platform)}
                    className="accent-pink-500 w-4 h-4"
                  />
                  <span className="text-lg leading-none">{PLATFORM_ICONS[platform]}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${enabled ? "text-pink-700" : "text-gray-700"}`}>
                      {platform === "windows" ? "Windows" : platform === "linux" ? "Linux" : "Android"}
                    </div>
                    {platform === "android" && (
                      <div className="text-xs text-amber-500 flex items-center gap-1 mt-0.5">
                        <Info size={10} />
                        {t("project.platform_android_note")}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-pink-500">*</span>}
        {hint && <span className="text-xs font-normal text-gray-400 ml-1">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}
