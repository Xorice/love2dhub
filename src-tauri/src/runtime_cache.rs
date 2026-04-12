use std::path::{Path, PathBuf};
use anyhow::Result;
use crate::models::CachedRuntime;

/// 返回 Love2D 运行时的默认缓存根目录
/// Windows: %APPDATA%\love2dhub\runtimes\
/// macOS:   ~/Library/Application Support/love2dhub/runtimes/
/// Linux:   ~/.local/share/love2dhub/runtimes/
pub fn runtimes_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("love2dhub")
        .join("runtimes")
}

/// 根据可选自定义目录返回运行时根目录
pub fn runtimes_dir_for(custom: Option<&str>) -> PathBuf {
    match custom {
        Some(dir) if !dir.is_empty() => PathBuf::from(dir),
        _ => runtimes_dir(),
    }
}

/// 指定版本+平台的缓存目录（支持自定义根目录）
pub fn runtime_dir_for(version: &str, platform: &str, custom: Option<&str>) -> PathBuf {
    runtimes_dir_for(custom).join(version).join(platform)
}

/// 列出已缓存的运行时（支持自定义根目录）
pub fn list_cached_at(custom: Option<&str>) -> Result<Vec<CachedRuntime>> {
    let root = runtimes_dir_for(custom);
    if !root.exists() {
        return Ok(vec![]);
    }

    let mut result = vec![];

    for version_entry in std::fs::read_dir(&root)? {
        let version_entry = version_entry?;
        if !version_entry.file_type()?.is_dir() { continue; }
        let version = version_entry.file_name().to_string_lossy().to_string();

        for platform_entry in std::fs::read_dir(version_entry.path())? {
            let platform_entry = platform_entry?;
            if !platform_entry.file_type()?.is_dir() { continue; }
            let platform = platform_entry.file_name().to_string_lossy().to_string();

            let dir_path = platform_entry.path();
            let size = dir_size(&dir_path).unwrap_or(0);

            result.push(CachedRuntime {
                version: version.clone(),
                platform,
                path: dir_path.to_string_lossy().to_string(),
                size,
            });
        }
    }

    Ok(result)
}

/// 删除指定版本+平台的缓存（支持自定义根目录）
pub fn delete_cached_at(version: &str, platform: &str, custom: Option<&str>) -> Result<()> {
    let dir = runtime_dir_for(version, platform, custom);
    if dir.exists() {
        std::fs::remove_dir_all(&dir)?;
    }
    Ok(())
}

fn dir_size(path: &Path) -> Result<u64> {
    let mut total = 0u64;
    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let meta = entry.metadata()?;
        if meta.is_dir() {
            total += dir_size(&entry.path()).unwrap_or(0);
        } else {
            total += meta.len();
        }
    }
    Ok(total)
}
