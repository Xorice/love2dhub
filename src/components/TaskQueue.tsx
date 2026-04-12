import { useState } from "react";
import {
  ChevronDown, ChevronUp, Download, Hammer,
  CheckCircle, XCircle, Loader2,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { useT } from "../i18n/useT";

export default function TaskQueue() {
  const { activeDownloads, isBuilding, buildProgressList } = useAppStore();
  const t = useT();
  const [collapsed, setCollapsed] = useState(false);

  const downloadEntries = Object.values(activeDownloads);
  const totalActive = downloadEntries.length + (isBuilding ? 1 : 0);

  if (totalActive === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 w-80 shadow-xl rounded-xl overflow-hidden border border-gray-200 bg-white dark:bg-[#1e1e1e] dark:border-[#303030]">
      {/* 标题栏 */}
      <div
        className="flex items-center justify-between px-4 py-2.5 bg-gray-900 text-white cursor-pointer select-none"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Loader2 size={14} className="animate-spin text-pink-400" />
          <span className="text-sm font-medium">
            {t("task_queue.title")}
            <span className="ml-2 bg-pink-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {totalActive}
            </span>
          </span>
        </div>
        <button className="text-gray-400 hover:text-white transition-colors">
          {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* 任务列表 */}
      {!collapsed && (
        <div className="divide-y divide-gray-100 dark:divide-[#2a2a2a] max-h-72 overflow-y-auto">
          {downloadEntries.map((dl) => (
            <DownloadTaskRow key={`${dl.version}::${dl.platform}`} dl={dl} />
          ))}
          {isBuilding && (
            <BuildTaskRow targets={buildProgressList} />
          )}
        </div>
      )}
    </div>
  );
}

// ── 下载任务行 ─────────────────────────────────────────────

function DownloadTaskRow({
  dl,
}: {
  dl: ReturnType<typeof useAppStore.getState>["activeDownloads"][string];
}) {
  const pct = Math.min(100, Math.round(dl.percent));
  return (
    <div className="px-4 py-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <Download size={13} className="text-pink-500 flex-shrink-0" />
        <span className="text-xs font-medium text-gray-800 dark:text-[#c0c0c0] flex-1 truncate">
          LÖVE {dl.version} · {dl.platform}
        </span>
        <span className="text-xs text-gray-400 flex-shrink-0">{pct}%</span>
      </div>
      <div className="w-full bg-gray-100 dark:bg-[#2a2a2a] rounded-full h-1.5">
        <div
          className="bg-pink-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-gray-400">
        {fmt(dl.downloaded)} / {fmt(dl.total)}
      </div>
    </div>
  );
}

// ── 构建任务行 ─────────────────────────────────────────────

function BuildTaskRow({
  targets,
}: {
  targets: ReturnType<typeof useAppStore.getState>["buildProgressList"];
}) {
  const t = useT();
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <Hammer size={13} className="text-pink-500 flex-shrink-0" />
        <span className="text-xs font-medium text-gray-800 dark:text-[#c0c0c0] flex-1">{t("task_queue.building")}</span>
      </div>
      {targets.map((tgt) => (
        <div key={tgt.platform} className="flex items-center gap-2 pl-5">
          <StatusIcon status={tgt.status} />
          <span className="text-xs text-gray-600 dark:text-[#909090] flex-1 capitalize">{tgt.platform}</span>
          <span className="text-xs text-gray-400 truncate max-w-24">{tgt.message}</span>
        </div>
      ))}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle size={12} className="text-green-500" />;
  if (status === "error")   return <XCircle size={12} className="text-red-500" />;
  if (status === "running") return <Loader2 size={12} className="animate-spin text-pink-500" />;
  return <div className="w-3 h-3 rounded-full bg-gray-200 border border-gray-300" />;
}

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
