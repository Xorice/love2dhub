import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  Love2DRelease, CachedRuntime, ProjectConfig,
  DownloadProgress, PackagedGame,
} from "../types";

// ── 版本 ──────────────────────────────────────────────────
export async function fetchReleases(): Promise<Love2DRelease[]> {
  return invoke<Love2DRelease[]>("fetch_love2d_releases");
}

export async function listCachedRuntimes(runtimeDir?: string): Promise<CachedRuntime[]> {
  return invoke<CachedRuntime[]>("list_cached_runtimes", { runtimeDir: runtimeDir || null });
}

// ── 下载 ──────────────────────────────────────────────────
export async function downloadRuntime(
  version: string, platform: string, runtimeDir?: string
): Promise<void> {
  return invoke("download_runtime", { version, platform, runtimeDir: runtimeDir || null });
}

export async function deleteRuntime(
  version: string, platform: string, runtimeDir?: string
): Promise<void> {
  return invoke("delete_runtime", { version, platform, runtimeDir: runtimeDir || null });
}

export async function openRuntimeDir(
  version: string, platform: string, runtimeDir?: string
): Promise<void> {
  return invoke("open_runtime_dir", { version, platform, runtimeDir: runtimeDir || null });
}

export async function openRuntimeVersionDir(
  version: string, runtimeDir?: string
): Promise<void> {
  return invoke("open_runtime_version_dir", { version, runtimeDir: runtimeDir || null });
}

export function onDownloadProgress(cb: (p: DownloadProgress) => void) {
  return listen<DownloadProgress>("download-progress", (e) => cb(e.payload));
}

// ── 构建 ──────────────────────────────────────────────────
export async function buildGame(
  config: ProjectConfig,
  runtimeDir?: string,
  defaultOutputDir?: string,
  androidSdkDir?: string,
  jdk17Dir?: string,
  keystorePath?: string,
  keystorePassword?: string,
  keystoreKeyAlias?: string,
  keystoreKeyPassword?: string,
): Promise<void> {
  return invoke("build_game", {
    config,
    runtimeDir: runtimeDir || null,
    defaultOutputDir: defaultOutputDir || null,
    androidSdkDir: androidSdkDir || null,
    jdk17Dir: jdk17Dir || null,
    keystorePath: keystorePath || null,
    keystorePassword: keystorePassword || null,
    keystoreKeyAlias: keystoreKeyAlias || null,
    keystoreKeyPassword: keystoreKeyPassword || null,
  });
}

export function onBuildLog(cb: (msg: string) => void) {
  return listen<string>("build-log", (e) => cb(e.payload));
}

// ── 已打包程序 ─────────────────────────────────────────────
export async function listPackages(
  platforms: string[],
  defaultOutputDir?: string,
): Promise<PackagedGame[]> {
  return invoke<PackagedGame[]>("list_packages", {
    platforms,
    defaultOutputDir: defaultOutputDir || null,
  });
}

export async function runPackage(path: string): Promise<void> {
  return invoke("run_package", { path });
}

export async function openPackageDir(outputDir: string): Promise<void> {
  return invoke("open_package_dir", { outputDir });
}

export async function deletePackage(path: string, platform: string): Promise<void> {
  return invoke("delete_package", { path, platform });
}

export async function getHostPlatform(): Promise<string> {
  return invoke<string>("get_host_platform");
}

export async function getDefaultDirs(): Promise<{ runtimeDir: string; buildDir: string }> {
  const [runtimeDir, buildDir] = await invoke<[string, string]>("get_default_dirs");
  return { runtimeDir, buildDir };
}


/** 在文件管理器中打开指定路径，不存在时自动创建目录 */
export async function openPath(path: string): Promise<void> {
  return invoke("open_path", { path });
}

// ── 文件对话框（静态导入，修复 Tauri 2.0 兼容问题）────────
export async function openFolderDialog(): Promise<string | null> {
  const result = await open({ directory: true, multiple: false });
  return result as string | null;
}

export async function openFileDialog(
  filters?: { name: string; extensions: string[] }[]
): Promise<string | null> {
  const result = await open({ directory: false, multiple: false, filters });
  return result as string | null;
}
