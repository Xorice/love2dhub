use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GithubRelease {
    pub tag_name: String,
    pub name: String,
    pub published_at: String,
    pub prerelease: bool,
    pub assets: Vec<GithubAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GithubAsset {
    pub name: String,
    pub browser_download_url: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedRuntime {
    pub version: String,
    pub platform: String,
    pub path: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub version: String,
    pub platform: String,
    pub downloaded: u64,
    pub total: u64,
    pub percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
    #[serde(rename = "sourcePath")]
    pub source_path: String,
    #[serde(rename = "iconPath")]
    pub icon_path: String,
    #[serde(rename = "love2dVersion")]
    pub love2d_version: String,
    pub targets: Vec<BuildTarget>,
    /// 是否在打包前用 LuaJIT 编译 .lua 为字节码
    #[serde(rename = "compileLua", default)]
    pub compile_lua: bool,
    // ── Windows 可执行文件元数据 ──────────────────────────
    #[serde(rename = "winProductName", default)]
    pub win_product_name: String,
    #[serde(rename = "winFileDescription", default)]
    pub win_file_description: String,
    #[serde(rename = "winCopyright", default)]
    pub win_copyright: String,
    // ── Android 元数据 ────────────────────────────────────
    /// Android 应用包名，如 com.example.mygame（空则自动生成）
    #[serde(rename = "androidAppId", default)]
    pub android_app_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildTarget {
    pub platform: String,
    pub enabled: bool,
    #[serde(rename = "outputDir")]
    pub output_dir: String,
}

// ── 已打包程序 ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackagedGame {
    pub name: String,
    pub platform: String,
    /// 可执行文件 / .app / .love / .apk 的完整路径
    pub path: String,
    #[serde(rename = "outputDir")]
    pub output_dir: String,
    pub size: u64,
    /// 文件修改时间（Unix 秒），用于排序
    #[serde(rename = "modifiedTime")]
    pub modified_time: u64,
}
