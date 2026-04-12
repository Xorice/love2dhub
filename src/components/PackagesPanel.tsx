import { useEffect, useCallback, useState } from "react";
import {
  Box, RefreshCw, Play, FolderOpen, Trash2,
  AlertCircle, MonitorPlay,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import {
  listPackages, runPackage, openPackageDir,
  deletePackage, getHostPlatform,
} from "../lib/tauri";
import type { PackagedGame } from "../types";
import { useT } from "../i18n/useT";

const ALL_PLATFORMS = ["windows", "macos", "linux", "android", "ios"] as const;

const PLATFORM_ICONS: Record<string, string> = {
  windows: "🪟", macos: "🍎", linux: "🐧", android: "📦", ios: "📱",
};

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function PackagesPanel() {
  const { settings } = useAppStore();
  const t = useT();
  const [games, setGames] = useState<PackagedGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [hostPlatform, setHostPlatform] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listPackages(
        [...ALL_PLATFORMS],
        settings.defaultOutputDir || undefined,
      );
      setGames(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [settings.defaultOutputDir]);

  useEffect(() => {
    getHostPlatform().then(setHostPlatform);
  }, []);

  useEffect(() => {
    scan();
  }, [scan]);

  async function handleRun(game: PackagedGame) {
    try {
      await runPackage(game.path);
    } catch (e) {
      alert(`Run failed: ${e}`);
    }
  }

  async function handleDelete(game: PackagedGame) {
    try {
      await deletePackage(game.path, game.platform);
      setPendingDelete(null);
      await scan();
    } catch (e) {
      setPendingDelete(null);
      alert(`Delete failed: ${e}`);
    }
  }

  const groupedByGame: Record<string, PackagedGame[]> = {};
  for (const g of games) {
    if (!groupedByGame[g.name]) groupedByGame[g.name] = [];
    groupedByGame[g.name].push(g);
  }
  const sortedGroups = Object.entries(groupedByGame)
    .map(([name, list]) => ({
      name,
      list: [...list].sort((a, b) => b.modifiedTime - a.modifiedTime),
    }))
    .sort((a, b) => b.list[0].modifiedTime - a.list[0].modifiedTime);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 页头 */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e8e8e8]">{t("packages.title")}</h2>
          <p className="text-sm text-gray-500 dark:text-[#909090] mt-0.5">{t("packages.subtitle")}</p>
        </div>
        <button
          onClick={scan}
          disabled={loading}
          className="btn-ghost border border-gray-200 flex-shrink-0"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {t("common.refresh")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        {!loading && games.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Box size={40} className="text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">{t("packages.title")}</p>
            <p className="text-sm text-gray-400 mt-1">{t("packages.subtitle")}</p>
          </div>
        )}

        {sortedGroups.map(({ name: gameName, list }) => (
          <div key={gameName} className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 dark:bg-[#1e1e1e] flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center flex-shrink-0">
                <MonitorPlay size={15} className="text-pink-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-gray-900 dark:text-[#e8e8e8]">{gameName}</span>
                <span className="text-xs text-gray-400 ml-2">{list.length}</span>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {list.map((g) => (
                  <span key={g.platform} className="text-xs bg-pink-50 text-pink-500 border border-pink-200 px-2 py-0.5 rounded-full">
                    {PLATFORM_ICONS[g.platform] ?? "💾"} {g.platform}
                  </span>
                ))}
              </div>
            </div>

            <div className="divide-y divide-gray-50 dark:divide-[#2a2a2a]">
              {list.map((game) => {
                const canRun = hostPlatform === game.platform;
                return (
                  <div key={game.path} className="flex items-center px-4 py-3 gap-3 group hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors">
                    <span className="text-xl flex-shrink-0 w-8 text-center">
                      {PLATFORM_ICONS[game.platform] ?? "💾"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-700 dark:text-[#c0c0c0] capitalize">{game.platform}</div>
                      <div className="text-xs text-gray-400 truncate">{game.path}</div>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">{fmt(game.size)}</span>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {canRun ? (
                        <button
                          onClick={() => handleRun(game)}
                          className="btn-primary py-1.5 px-3 text-xs"
                        >
                          <Play size={12} fill="currentColor" />
                          Run
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300 px-3 py-1.5 border border-gray-100 rounded-lg">
                          {game.platform} only
                        </span>
                      )}
                      <button
                        onClick={() => openPackageDir(game.outputDir).catch(() => {})}
                        className="btn-ghost text-xs py-1.5 px-2.5"
                      >
                        <FolderOpen size={13} />
                      </button>
                      {pendingDelete === game.path ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(game)}
                            className="btn-danger text-xs py-1.5 px-2.5"
                          >
                            {t("common.confirm_delete")}
                          </button>
                          <button
                            onClick={() => setPendingDelete(null)}
                            className="btn-ghost border border-gray-200 text-xs py-1.5 px-2.5"
                          >
                            {t("common.cancel")}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPendingDelete(game.path)}
                          className="btn-danger text-xs py-1.5 px-2.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
