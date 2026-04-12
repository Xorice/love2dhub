import { useEffect, useState } from "react";
import {
  RefreshCw, Download, Trash2, FolderOpen,
  CheckCircle, Loader2, AlertCircle, HardDrive, CloudDownload, ChevronDown, ChevronRight,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import {
  fetchReleases, listCachedRuntimes,
  downloadRuntime, deleteRuntime, openRuntimeDir, openRuntimeVersionDir,
  onDownloadProgress,
} from "../lib/tauri";
import type { Platform } from "../types";
import { useT } from "../i18n/useT";

type SubTab = "downloaded" | "fetch";
type AnyPlatform = Platform | "android-template";
type DlKey = string;

const PLATFORMS: AnyPlatform[] = ["windows", "linux", "android-template"];
const PLATFORM_ICONS: Record<AnyPlatform, string> = {
  windows: "🪟", macos: "🍎", linux: "🐧", android: "📦", ios: "📱",
  "android-template": "📦",
};
const PLATFORM_LABEL: Partial<Record<AnyPlatform, string>> = {
  "android-template": "Android",
};

export default function VersionManager() {
  const {
    releases, releasesLoading, releasesError,
    cachedRuntimes, downloadProgress,
    setReleases, setReleasesLoading, setReleasesError,
    setCachedRuntimes, setDownloadProgress,
    settings,
  } = useAppStore();
  const t = useT();

  const [subTab, setSubTab] = useState<SubTab>("downloaded");
  const [showPrerelease, setShowPrerelease] = useState(true);
  const [downloading, setDownloading] = useState<Set<DlKey>>(new Set());

  useEffect(() => {
    loadCached();
    const unlisten = onDownloadProgress((p) => {
      setDownloadProgress(p);
      if (p.percent >= 100) {
        const key: DlKey = `${p.version}::${p.platform as Platform}`;
        setDownloading((prev) => { const s = new Set(prev); s.delete(key); return s; });
        setDownloadProgress(null);
        loadCached();
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  async function loadCached() {
    const list = await listCachedRuntimes(settings.runtimeDir || undefined);
    setCachedRuntimes(list);
  }

  async function loadReleases() {
    setReleasesLoading(true);
    setReleasesError(null);
    try {
      setReleases(await fetchReleases());
    } catch (e) {
      setReleasesError(String(e));
    } finally {
      setReleasesLoading(false);
    }
  }

  async function handleDownload(version: string, platform: AnyPlatform) {
    const key: DlKey = `${version}::${platform}`;
    setDownloading((prev) => new Set(prev).add(key));
    try {
      await downloadRuntime(version, platform, settings.runtimeDir || undefined);
    } catch (e) {
      alert(`${t("common.download")} failed: ${e}`);
      setDownloading((prev) => { const s = new Set(prev); s.delete(key); return s; });
    }
  }

  async function handleDelete(version: string, platform: AnyPlatform) {
    const label = PLATFORM_LABEL[platform] ?? platform;
    if (!confirm(t("versions.confirm_delete", { version, platform: label }))) return;
    await deleteRuntime(version, platform, settings.runtimeDir || undefined);
    loadCached();
  }

  function isCached(version: string, platform: AnyPlatform) {
    return cachedRuntimes.some((c) => c.version === version && c.platform === platform);
  }

  function isDownloading(version: string, platform: AnyPlatform) {
    return downloading.has(`${version}::${platform}`);
  }

  const visibleReleases = showPrerelease
    ? releases
    : releases.filter((r) => !r.prerelease);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 页头 */}
      <div className="px-6 pt-6 pb-0 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e8e8e8]">{t("versions.title")}</h2>
        <p className="text-sm text-gray-500 dark:text-[#909090] mt-0.5">{t("versions.subtitle")}</p>

        {/* 子 Tab */}
        <div className="flex gap-1 mt-4 bg-gray-100 dark:bg-[#252525] p-1 rounded-lg w-fit">
          <SubTabBtn
            active={subTab === "downloaded"}
            icon={<HardDrive size={14} />}
            label={t("versions.tab_downloaded")}
            onClick={() => setSubTab("downloaded")}
          />
          <SubTabBtn
            active={subTab === "fetch"}
            icon={<CloudDownload size={14} />}
            label={t("versions.tab_fetch")}
            onClick={() => { setSubTab("fetch"); if (releases.length === 0) loadReleases(); }}
          />
        </div>
      </div>

      {/* 全局下载进度条 */}
      {downloadProgress && (
        <div className="mx-6 mt-4 card p-4 border-pink-200 bg-pink-50 flex-shrink-0">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-pink-700">
              {t("versions.downloading_title", { version: downloadProgress.version, platform: downloadProgress.platform })}
            </span>
            <span className="text-pink-500">{downloadProgress.percent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-pink-100 rounded-full h-1.5">
            <div
              className="bg-pink-500 h-1.5 rounded-full transition-all"
              style={{ width: `${downloadProgress.percent}%` }}
            />
          </div>
          <div className="text-xs text-pink-400 mt-1.5">
            {fmt(downloadProgress.downloaded)} / {fmt(downloadProgress.total)}
          </div>
        </div>
      )}

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-6 pt-4">
        {subTab === "downloaded" ? (
          <DownloadedTab
            cachedRuntimes={cachedRuntimes}
            onDelete={handleDelete}
            runtimeDir={settings.runtimeDir || undefined}
          />
        ) : (
          <FetchTab
            releases={visibleReleases}
            loading={releasesLoading}
            error={releasesError}
            showPrerelease={showPrerelease}
            onTogglePrerelease={setShowPrerelease}
            onRefresh={loadReleases}
            isCached={isCached}
            isDownloading={isDownloading}
            onDownload={handleDownload}
          />
        )}
      </div>
    </div>
  );
}

// ── 已下载 Tab ────────────────────────────────────────────

function DownloadedTab({
  cachedRuntimes,
  onDelete,
  runtimeDir,
}: {
  cachedRuntimes: ReturnType<typeof useAppStore.getState>["cachedRuntimes"];
  onDelete: (version: string, platform: AnyPlatform) => void;
  runtimeDir?: string;
}) {
  const t = useT();

  if (cachedRuntimes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center">
        <HardDrive size={36} className="text-gray-300 mb-3" />
        <p className="text-gray-500 font-medium">{t("versions.no_runtimes")}</p>
        <p className="text-sm text-gray-400 mt-1">{t("versions.no_runtimes_hint")}</p>
      </div>
    );
  }

  const grouped: Record<string, typeof cachedRuntimes> = {};
  for (const r of cachedRuntimes) {
    if (!grouped[r.version]) grouped[r.version] = [];
    grouped[r.version].push(r);
  }

  return (
    <div className="space-y-3">
      {Object.entries(grouped)
        .sort(([a], [b]) => b.localeCompare(a, undefined, { numeric: true }))
        .map(([version, runtimes]) => (
          <div key={version} className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 dark:bg-[#1e1e1e] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 dark:text-[#e8e8e8]">LÖVE {version}</span>
                <span className="text-xs text-gray-400">{t("versions.platforms_count", { count: runtimes.length })}</span>
              </div>
              <button
                onClick={() => openRuntimeVersionDir(version, runtimeDir).catch(() => {})}
                className="text-xs text-gray-400 hover:text-blue-500 flex items-center gap-1 transition-colors"
              >
                <FolderOpen size={12} />
                {t("common.open_version_dir")}
              </button>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-[#2a2a2a]">
              {runtimes.map((rt) => {
                const p = rt.platform as AnyPlatform;
                return (
                  <div key={rt.platform} className="flex items-center px-4 py-3 gap-3">
                    <span className="text-lg">{PLATFORM_ICONS[p] ?? "💾"}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-800 dark:text-[#c0c0c0]">
                        {PLATFORM_LABEL[p] ?? rt.platform}
                      </div>
                      <div className="text-xs text-gray-400">{fmt(rt.size)}</div>
                    </div>
                    <button
                      onClick={() => openRuntimeDir(rt.version, rt.platform, runtimeDir)}
                      className="btn-ghost text-xs"
                    >
                      <FolderOpen size={13} />
                      {t("common.open_dir")}
                    </button>
                    <button
                      onClick={() => onDelete(version, p)}
                      className="btn-danger text-xs"
                    >
                      <Trash2 size={13} />
                      {t("common.delete")}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}

// ── 获取版本 Tab ──────────────────────────────────────────

function FetchTab({
  releases, loading, error,
  showPrerelease, onTogglePrerelease,
  onRefresh, isCached, isDownloading, onDownload,
}: {
  releases: ReturnType<typeof useAppStore.getState>["releases"];
  loading: boolean;
  error: string | null;
  showPrerelease: boolean;
  onTogglePrerelease: (v: boolean) => void;
  onRefresh: () => void;
  isCached: (v: string, p: AnyPlatform) => boolean;
  isDownloading: (v: string, p: AnyPlatform) => boolean;
  onDownload: (v: string, p: AnyPlatform) => void;
}) {
  const t = useT();
  const [expandedTag, setExpandedTag] = useState<string | null>(null);

  function toggleExpand(tag: string) {
    setExpandedTag((prev) => (prev === tag ? null : tag));
  }

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showPrerelease}
            onChange={(e) => onTogglePrerelease(e.target.checked)}
            className="accent-pink-500"
          />
          {t("versions.show_prerelease")}
        </label>
        <button onClick={onRefresh} disabled={loading} className="btn-ghost border border-gray-200">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {t("versions.refresh_list")}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
          {t("versions.fetching")}
        </div>
      )}

      {!loading && releases.length === 0 && !error && (
        <div className="text-center py-12 text-gray-400 text-sm">
          {t("versions.fetch_hint")}
        </div>
      )}

      {releases.map((release) => (
        <ReleaseCard
          key={release.tag_name}
          release={release}
          expanded={expandedTag === release.tag_name}
          onToggle={() => toggleExpand(release.tag_name)}
          isCached={isCached}
          isDownloading={isDownloading}
          onDownload={onDownload}
        />
      ))}
    </div>
  );
}

// ── 版本卡（可折叠）─────────────────────────────────────────

function ReleaseCard({
  release, expanded, onToggle, isCached, isDownloading, onDownload,
}: {
  release: ReturnType<typeof useAppStore.getState>["releases"][number];
  expanded: boolean;
  onToggle: () => void;
  isCached: (v: string, p: AnyPlatform) => boolean;
  isDownloading: (v: string, p: AnyPlatform) => boolean;
  onDownload: (v: string, p: AnyPlatform) => void;
}) {
  const t = useT();
  const hasAnyCached = PLATFORMS.some((p) => isCached(release.tag_name, p));

  return (
    <div className="card overflow-hidden">
      <div
        className="px-4 py-3 border-b border-gray-100 bg-gray-50 dark:bg-[#1e1e1e] flex items-center justify-between cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-[#252525] transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
          <span className="font-semibold text-gray-900 dark:text-[#e8e8e8]">{release.name || release.tag_name}</span>
          {release.prerelease && (
            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-600 rounded-full font-medium">
              {t("versions.prerelease")}
            </span>
          )}
          {hasAnyCached && (
            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded-full">
              {t("common.downloaded")}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {new Date(release.published_at).toLocaleDateString()}
        </span>
      </div>

      {expanded && (
        <div className="divide-y divide-gray-50 dark:divide-[#2a2a2a]">
          {PLATFORMS.map((platform) => {
            const cached = isCached(release.tag_name, platform);
            const inDl = isDownloading(release.tag_name, platform);
            return (
              <div key={platform} className={`flex items-center px-4 py-2.5 gap-3 ${platform === "android-template" ? "border-t border-dashed border-gray-200 bg-gray-50/50" : ""}`}>
                <span className="text-base">{PLATFORM_ICONS[platform]}</span>
                <span className="text-sm text-gray-700 dark:text-[#c0c0c0] w-24">{PLATFORM_LABEL[platform] ?? platform}</span>
                <div className="flex-1">
                  {cached ? (
                    <span className="flex items-center gap-1.5 text-xs text-green-600">
                      <CheckCircle size={12} />
                      {t("common.downloaded")}
                    </span>
                  ) : inDl ? (
                    <span className="flex items-center gap-1.5 text-xs text-pink-500">
                      <Loader2 size={12} className="animate-spin" />
                      {t("common.downloading")}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">{t("common.not_downloaded")}</span>
                  )}
                </div>
                {!cached && !inDl && (
                  <button
                    onClick={() => onDownload(release.tag_name, platform)}
                    className="btn-primary py-1.5 px-3 text-xs"
                  >
                    <Download size={12} />
                    {t("common.download")}
                  </button>
                )}
                {cached && <span className="text-xs text-gray-300">✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 通用 ──────────────────────────────────────────────────

function SubTabBtn({
  active, icon, label, onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
        active
          ? "bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-[#e8e8e8] shadow-sm"
          : "text-gray-500 hover:text-gray-700 dark:text-[#606060] dark:hover:text-[#c0c0c0]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
