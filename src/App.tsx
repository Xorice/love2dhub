import { useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import i18n from "./i18n";
import Sidebar from "./components/Sidebar";
import ProjectConfig from "./components/ProjectConfig";
import VersionManager from "./components/VersionManager";
import BuildPanel from "./components/BuildPanel";
import PackagesPanel from "./components/PackagesPanel";
import SettingsPanel from "./components/SettingsPanel";
import AboutPanel from "./components/AboutPanel";
import TaskQueue from "./components/TaskQueue";
import { useAppStore } from "./store/useAppStore";
import { onDownloadProgress, listCachedRuntimes } from "./lib/tauri";

export default function App() {
  const {
    activeTab,
    settings,
    setActiveTab,
    setSettings,
    setCachedRuntimes,
    setActiveDownload,
  } = useAppStore();

  // ── 首次启动跳转设置页 ──────────────────────────────────
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (settings.openSettingsOnStartup) {
      setActiveTab("settings");
      // 关闭开关，下次不再自动跳转
      setSettings({ openSettingsOnStartup: false });
    }
  }, []);

  // ── 主题管理 ────────────────────────────────────────────
  useEffect(() => {
    const html = document.documentElement;
    const tauri = getCurrentWindow();

    function apply(dark: boolean) {
      if (dark) {
        html.classList.add("dark");
        tauri.setTheme("dark").catch(() => {});
      } else {
        html.classList.remove("dark");
        tauri.setTheme("light").catch(() => {});
      }
    }

    if (settings.theme === "dark") {
      apply(true);
      return;
    }
    if (settings.theme === "light") {
      apply(false);
      return;
    }

    // system
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [settings.theme]);

  // ── 语言切换 ────────────────────────────────────────────
  useEffect(() => {
    i18n.changeLanguage(settings.language ?? "zh-CN");
  }, [settings.language]);

  // ── 运行时列表 ──────────────────────────────────────────
  useEffect(() => {
    listCachedRuntimes(settings.runtimeDir || undefined)
      .then(setCachedRuntimes)
      .catch(() => {});
  }, [settings.runtimeDir]);

  // ── 全局下载进度监听 ────────────────────────────────────
  useEffect(() => {
    const unlisten = onDownloadProgress((p) => {
      const key = `${p.version}::${p.platform}`;
      if (p.percent >= 100) {
        setActiveDownload(key, p);
        setTimeout(() => setActiveDownload(key, null), 1500);
      } else {
        setActiveDownload(key, p);
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-[#111111]">
        {activeTab === "project"  && <ProjectConfig />}
        {activeTab === "versions" && <VersionManager />}
        {activeTab === "build"    && <BuildPanel />}
        {activeTab === "packages" && <PackagesPanel />}
        {activeTab === "settings" && <SettingsPanel />}
        {activeTab === "about"    && <AboutPanel />}
      </main>
      <TaskQueue />
    </div>
  );
}
