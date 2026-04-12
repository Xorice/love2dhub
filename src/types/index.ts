export interface Love2DRelease {
  tag_name: string;
  name: string;
  published_at: string;
  prerelease: boolean;
  assets: ReleaseAsset[];
}

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface CachedRuntime {
  version: string;
  platform: Platform;
  path: string;
  size: number;
}

export type Platform = "windows" | "macos" | "linux" | "ios" | "android";

export interface ProjectConfig {
  name: string;
  version: string;
  author: string;
  description: string;
  sourcePath: string;
  iconPath: string;
  love2dVersion: string;
  targets: BuildTarget[];
  /** 是否在打包前用 LuaJIT 编译 .lua 文件为字节码 */
  compileLua: boolean;
  /** Android 应用包名，如 com.example.mygame（空则自动生成） */
  androidAppId: string;
}

export interface BuildTarget {
  platform: Platform;
  enabled: boolean;
  outputDir: string;
}

export interface BuildProgress {
  platform: Platform;
  status: "pending" | "running" | "success" | "error";
  message: string;
  percent: number;
}

export interface DownloadProgress {
  version: string;
  platform: Platform;
  downloaded: number;
  total: number;
  percent: number;
}

export interface AppSettings {
  runtimeDir: string;
  defaultOutputDir: string;
  androidSdkDir: string;
  jdk17Dir: string;
  /** Android 构建模式：debug（侧载）或 release（应用商店） */
  androidBuildMode: "debug" | "release";
  /** Android release 签名 keystore 路径 */
  keystorePath: string;
  /** Keystore 密码 */
  keystorePassword: string;
  /** Key 别名 */
  keystoreKeyAlias: string;
  /** Key 密码（留空则与 keystore 密码相同） */
  keystoreKeyPassword: string;
  /** 主题：浅色 / 深色 / 跟随系统 */
  theme: "light" | "dark" | "system";
  /** 启动时自动跳转到设置页面（首次启动默认 true） */
  openSettingsOnStartup: boolean;
  /** 界面语言 */
  language: "zh-CN" | "en";
}

export interface PackagedGame {
  name: string;
  platform: Platform;
  /** 可执行文件 / .app / .love / .apk 的完整路径 */
  path: string;
  /** 所在导出目录 */
  outputDir: string;
  size: number;
  /** 文件修改时间（Unix 秒），用于排序 */
  modifiedTime: number;
}
