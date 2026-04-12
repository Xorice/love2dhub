import { create } from "zustand";
import type {
  Love2DRelease,
  CachedRuntime,
  ProjectConfig,
  BuildProgress,
  DownloadProgress,
  Platform,
  AppSettings,
} from "../types";

// ── settings 持久化 ────────────────────────────────────────
const defaultSettings: AppSettings = {
  runtimeDir: "",
  defaultOutputDir: "",
  androidSdkDir: "",
  jdk17Dir: "",
  androidBuildMode: "debug",
  keystorePath: "",
  keystorePassword: "",
  keystoreKeyAlias: "",
  keystoreKeyPassword: "",
  theme: "system",
  openSettingsOnStartup: true,
  language: "zh-CN",
};

function loadSettings(): AppSettings {
  try {
    const s = localStorage.getItem("love2dhub_settings");
    if (s) return { ...defaultSettings, ...JSON.parse(s) };
  } catch { /* ignore */ }
  return { ...defaultSettings };
}

function saveSettings(s: AppSettings) {
  try { localStorage.setItem("love2dhub_settings", JSON.stringify(s)); } catch { /* ignore */ }
}

// ── store types ────────────────────────────────────────────

export type ActiveTab = "project" | "metadata" | "versions" | "build" | "packages" | "settings" | "about";

interface AppState {
  // --- Love2D 版本 ---
  releases: Love2DRelease[];
  releasesLoading: boolean;
  releasesError: string | null;
  selectedVersion: string;

  // --- 本地缓存的运行时 ---
  cachedRuntimes: CachedRuntime[];

  // --- 下载进度 ---
  downloadProgress: DownloadProgress | null;
  /** 多任务下载进度 key = "version::platform" */
  activeDownloads: Record<string, DownloadProgress>;

  // --- 项目配置 ---
  project: ProjectConfig;

  // --- 打包进度 ---
  buildProgressList: BuildProgress[];
  isBuilding: boolean;
  /** 构建日志（持久，切换 Tab 不丢失） */
  buildLogs: string[];

  // --- 应用设置 ---
  settings: AppSettings;

  // --- 当前激活的 tab ---
  activeTab: ActiveTab;

  // actions
  setReleases: (releases: Love2DRelease[]) => void;
  setReleasesLoading: (loading: boolean) => void;
  setReleasesError: (error: string | null) => void;
  setSelectedVersion: (version: string) => void;
  setCachedRuntimes: (runtimes: CachedRuntime[]) => void;
  setDownloadProgress: (progress: DownloadProgress | null) => void;
  setActiveDownload: (key: string, progress: DownloadProgress | null) => void;
  updateProject: (patch: Partial<ProjectConfig>) => void;
  toggleTarget: (platform: Platform) => void;
  setTargetOutputDir: (platform: Platform, dir: string) => void;
  setBuildProgressList: (list: BuildProgress[]) => void;
  updateBuildProgress: (platform: Platform, patch: Partial<BuildProgress>) => void;
  setIsBuilding: (building: boolean) => void;
  addBuildLog: (msg: string) => void;
  clearBuildLogs: () => void;
  setSettings: (patch: Partial<AppSettings>) => void;
  setActiveTab: (tab: ActiveTab) => void;
}

const defaultProject: ProjectConfig = {
  name: "",
  version: "1.0.0",
  author: "",
  description: "",
  compileLua: false,
  winProductName: "",
  winFileDescription: "",
  winCompanyName: "",
  winCopyright: "",
  androidAppId: "",
  sourcePath: "",
  iconPath: "",
  love2dVersion: "",
  targets: [
    { platform: "windows", enabled: true,  outputDir: "" },
    { platform: "macos",   enabled: false, outputDir: "" },
    { platform: "linux",   enabled: false, outputDir: "" },
    { platform: "android", enabled: false, outputDir: "" },
    { platform: "ios",     enabled: false, outputDir: "" },
  ],
};

export const useAppStore = create<AppState>((set) => ({
  releases: [],
  releasesLoading: false,
  releasesError: null,
  selectedVersion: "",
  cachedRuntimes: [],
  downloadProgress: null,
  activeDownloads: {},
  project: defaultProject,
  buildProgressList: [],
  isBuilding: false,
  buildLogs: [],
  settings: loadSettings(),
  activeTab: "project",

  setReleases: (releases) => set({ releases }),
  setReleasesLoading: (releasesLoading) => set({ releasesLoading }),
  setReleasesError: (releasesError) => set({ releasesError }),
  setSelectedVersion: (selectedVersion) => set({ selectedVersion }),
  setCachedRuntimes: (cachedRuntimes) => set({ cachedRuntimes }),
  setDownloadProgress: (downloadProgress) => set({ downloadProgress }),

  setActiveDownload: (key, progress) =>
    set((s) => {
      const next = { ...s.activeDownloads };
      if (progress === null) {
        delete next[key];
      } else {
        next[key] = progress;
      }
      return { activeDownloads: next };
    }),

  updateProject: (patch) =>
    set((s) => ({ project: { ...s.project, ...patch } })),

  toggleTarget: (platform) =>
    set((s) => ({
      project: {
        ...s.project,
        targets: s.project.targets.map((t) =>
          t.platform === platform ? { ...t, enabled: !t.enabled } : t
        ),
      },
    })),

  setTargetOutputDir: (platform, dir) =>
    set((s) => ({
      project: {
        ...s.project,
        targets: s.project.targets.map((t) =>
          t.platform === platform ? { ...t, outputDir: dir } : t
        ),
      },
    })),

  setBuildProgressList: (buildProgressList) => set({ buildProgressList }),

  updateBuildProgress: (platform, patch) =>
    set((s) => ({
      buildProgressList: s.buildProgressList.map((p) =>
        p.platform === platform ? { ...p, ...patch } : p
      ),
    })),

  setIsBuilding: (isBuilding) => set({ isBuilding }),

  addBuildLog: (msg) =>
    set((s) => ({ buildLogs: [...s.buildLogs, msg] })),

  clearBuildLogs: () => set({ buildLogs: [] }),

  setSettings: (patch) =>
    set((s) => {
      const next = { ...s.settings, ...patch };
      saveSettings(next);
      return { settings: next };
    }),

  setActiveTab: (activeTab) => set({ activeTab }),
}));
