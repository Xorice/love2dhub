import { Info } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { useT } from "../i18n/useT";

export default function MetadataPanel() {
  const { project, updateProject } = useAppStore();
  const t = useT();

  const winEnabled  = project.targets.some((t2) => t2.platform === "windows" && t2.enabled);
  const droidEnabled = project.targets.some((t2) => t2.platform === "android" && t2.enabled);

  const ORIENTATIONS = [
    { value: "landscape",       label: t("metadata.orient_landscape") },
    { value: "portrait",        label: t("metadata.orient_portrait") },
    { value: "sensorLandscape", label: t("metadata.orient_sensor_landscape") },
    { value: "sensorPortrait",  label: t("metadata.orient_sensor_portrait") },
  ] as const;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e8e8e8]">{t("metadata.title")}</h2>
          <p className="text-sm text-gray-500 dark:text-[#909090] mt-0.5">{t("metadata.subtitle")}</p>
        </div>

        {/* 通用 */}
        <div className="card p-5">
          <p className="section-title mb-3">{t("metadata.section_general")}</p>
          <Field label={t("metadata.author")} hint={t("metadata.author_hint")}>
            <input className="input"
              value={project.author}
              onChange={(e) => updateProject({ author: e.target.value })}
              placeholder={t("metadata.author_placeholder")}
            />
          </Field>
        </div>

        {/* Windows */}
        <div className={`card p-5 ${!winEnabled ? "opacity-60" : ""}`}>
          <div className="flex items-center justify-between mb-3">
            <p className="section-title mb-0">🪟 {t("metadata.section_windows")}</p>
            {!winEnabled && (
              <span className="text-xs text-amber-500 flex items-center gap-1">
                <Info size={12} />{t("metadata.no_platform_hint")}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 dark:text-[#606060] mb-4">{t("metadata.windows_desc")}</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("metadata.win_product_name")} hint={t("metadata.win_product_name_hint")}>
              <input className="input" disabled={!winEnabled}
                value={project.winProductName}
                onChange={(e) => updateProject({ winProductName: e.target.value })}
                placeholder={t("metadata.win_product_name_placeholder")}
              />
            </Field>
            <Field label={t("metadata.win_file_description")}>
              <input className="input" disabled={!winEnabled}
                value={project.winFileDescription}
                onChange={(e) => updateProject({ winFileDescription: e.target.value })}
                placeholder={t("metadata.win_file_description_placeholder")}
              />
            </Field>
            <Field label={t("metadata.win_company_name")}>
              <input className="input" disabled={!winEnabled}
                value={project.winCompanyName}
                onChange={(e) => updateProject({ winCompanyName: e.target.value })}
                placeholder={t("metadata.win_company_name_placeholder")}
              />
            </Field>
            <Field label={t("metadata.win_copyright")}>
              <input className="input" disabled={!winEnabled}
                value={project.winCopyright}
                onChange={(e) => updateProject({ winCopyright: e.target.value })}
                placeholder={t("metadata.win_copyright_placeholder")}
              />
            </Field>
          </div>
        </div>

        {/* Android */}
        <div className={`card p-5 ${!droidEnabled ? "opacity-60" : ""}`}>
          <div className="flex items-center justify-between mb-3">
            <p className="section-title mb-0">📦 {t("metadata.section_android")}</p>
            {!droidEnabled && (
              <span className="text-xs text-amber-500 flex items-center gap-1">
                <Info size={12} />{t("metadata.no_platform_hint")}
              </span>
            )}
          </div>
          <div className="space-y-4">
            <Field label={t("metadata.android_app_id")} hint={t("metadata.android_app_id_hint")}>
              <input className="input" disabled={!droidEnabled}
                value={project.androidAppId}
                onChange={(e) => updateProject({ androidAppId: e.target.value })}
                placeholder={t("metadata.android_app_id_placeholder")}
                spellCheck={false}
                autoComplete="off"
              />
            </Field>
            <Field label={t("metadata.android_orientation")}>
              <div className="grid grid-cols-2 gap-2">
                {ORIENTATIONS.map(({ value, label }) => {
                  const active = project.androidOrientation === value;
                  return (
                    <button
                      key={value}
                      disabled={!droidEnabled}
                      onClick={() => updateProject({ androidOrientation: value })}
                      className={`px-3 py-2 rounded-lg border text-sm transition-colors text-left ${
                        active
                          ? "border-pink-400 bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 font-medium"
                          : "border-gray-200 dark:border-[#333] bg-white dark:bg-[#1e1e1e] text-gray-600 dark:text-[#909090] hover:border-gray-300"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, hint, children,
}: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-[#c0c0c0]">
        {label}
        {hint && <span className="text-xs font-normal text-gray-400 ml-1">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}
