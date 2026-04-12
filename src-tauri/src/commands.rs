use tauri::{AppHandle, Emitter};
use anyhow::Result;
use futures_util::StreamExt;
use std::io::Write;
use std::path::{Path, PathBuf};

use crate::models::*;
use crate::runtime_cache;

/// 主 API：拉取稳定版 + 预发布版（per_page=50 确保覆盖 v12 等新版）
const GITHUB_API: &str =
    "https://api.github.com/repos/love2d/love/releases?per_page=50";

// ── Love2D 内置 LuaJIT 编译 helper 脚本 ───────────────────
//
// 原理：Love2D 运行时内嵌了 LuaJIT。
// 我们用 love.exe 运行这个迷你脚本，脚本调用 string.dump() 把 .lua
// 编译成 LuaJIT 字节码，输出到目标目录。
// 用户无需安装任何额外工具。

const LUAC_MAIN: &str = r#"
-- Love2D 内置 LuaJIT 字节码编译器
-- 由 Love2D Hub 自动调用，通过环境变量接收路径（避免 Windows 参数传递问题）
local src_dir      = os.getenv("LOVE2DHUB_SRC")      or ""
local out_dir      = os.getenv("LOVE2DHUB_OUT")      or ""
local manifest_path = os.getenv("LOVE2DHUB_MANIFEST") or ""

if src_dir == "" or out_dir == "" or manifest_path == "" then
    io.stderr:write("ERROR: env vars not set (LOVE2DHUB_SRC/OUT/MANIFEST)\n")
    love.event.quit(1); return
end

local is_win = package.config:sub(1,1) == '\\'

local function mkdir_p(path)
    if is_win then
        os.execute('if not exist "' .. path:gsub('/', '\\') ..
                   '" mkdir "' .. path:gsub('/', '\\') .. '" >NUL 2>NUL')
    else
        os.execute('mkdir -p "' .. path .. '" 2>/dev/null')
    end
end

local function write_file(path, data)
    local f, err = io.open(path, "wb")
    if not f then return false, err end
    f:write(data); f:close(); return true
end

-- 读取文件列表清单
local mf = io.open(manifest_path, "r")
if not mf then
    io.stderr:write("ERROR: manifest not found: " .. manifest_path .. "\n")
    love.event.quit(1); return
end

local ok_n, fail_n = 0, 0
for line in mf:lines() do
    local rel = line:gsub("[\r\n]", "")
    if rel ~= "" then
        local src = src_dir .. "/" .. rel
        local dst = out_dir .. "/" .. rel

        local dir = dst:match("^(.*)[/\\][^/\\]+$")
        if dir then mkdir_p(dir) end

        local chunk, err = loadfile(src)
        if chunk then
            local ok, result = pcall(string.dump, chunk)
            if ok then
                local wrote, werr = write_file(dst, result)
                if wrote then
                    io.write("OK " .. rel .. "\n"); ok_n = ok_n + 1
                else
                    io.write("FAIL " .. rel .. " (write: " .. tostring(werr) .. ")\n")
                    fail_n = fail_n + 1
                end
            else
                io.write("FAIL " .. rel .. " (dump: " .. tostring(result) .. ")\n")
                fail_n = fail_n + 1
            end
        else
            io.write("FAIL " .. rel .. " (load: " .. tostring(err) .. ")\n")
            fail_n = fail_n + 1
        end
    end
end
mf:close()
io.write(string.format("compiled=%d failed=%d\n", ok_n, fail_n))
love.event.quit(0)
"#;

const LUAC_CONF: &str = r#"
function love.conf(t)
    t.window  = false   -- 不显示窗口
    t.console = true    -- Windows: 允许控制台输出
end
"#;

// ── 版本列表 ───────────────────────────────────────────────

#[tauri::command]
pub async fn fetch_love2d_releases() -> Result<Vec<GithubRelease>, String> {
    let client = reqwest::Client::builder()
        .user_agent("love2dhub/0.1")
        .build()
        .map_err(|e| e.to_string())?;

    client
        .get(GITHUB_API)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Vec<GithubRelease>>()
        .await
        .map_err(|e| e.to_string())
}

// ── 缓存管理 ───────────────────────────────────────────────

#[tauri::command]
pub fn list_cached_runtimes(runtime_dir: Option<String>) -> Result<Vec<CachedRuntime>, String> {
    runtime_cache::list_cached_at(runtime_dir.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_runtime(
    version: String,
    platform: String,
    runtime_dir: Option<String>,
) -> Result<(), String> {
    runtime_cache::delete_cached_at(&version, &platform, runtime_dir.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_runtime_dir(
    version: String,
    platform: String,
    runtime_dir: Option<String>,
) -> Result<(), String> {
    let dir = runtime_cache::runtime_dir_for(&version, &platform, runtime_dir.as_deref());
    let target = if dir.exists() {
        dir
    } else {
        runtime_cache::runtimes_dir_for(runtime_dir.as_deref())
    };
    std::fs::create_dir_all(&target).ok();
    open_in_explorer(&target)
}

fn open_in_explorer(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(path).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(path).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(path).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

// ── 下载运行时 ─────────────────────────────────────────────

#[tauri::command]
pub async fn download_runtime(
    app: AppHandle,
    version: String,
    platform: String,
    runtime_dir: Option<String>,
) -> Result<(), String> {
    let url = resolve_download_url(&version, &platform)
        .ok_or_else(|| format!("找不到 {version}/{platform} 的下载地址"))?;

    let dest_dir = runtime_cache::runtime_dir_for(&version, &platform, runtime_dir.as_deref());
    std::fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;

    let client = reqwest::Client::builder()
        .user_agent("love2dhub/0.1")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let total = response.content_length().unwrap_or(0);

    let filename = url.split('/').last().unwrap_or("runtime.zip");
    let tmp_path = dest_dir.join(filename);
    let mut file = std::fs::File::create(&tmp_path).map_err(|e| e.to_string())?;

    let mut downloaded = 0u64;
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        let percent = if total > 0 { downloaded as f64 / total as f64 * 100.0 } else { 0.0 };
        let _ = app.emit("download-progress", DownloadProgress {
            version: version.clone(), platform: platform.clone(),
            downloaded, total, percent,
        });
    }

    if filename.ends_with(".zip") {
        extract_zip(&tmp_path, &dest_dir).map_err(|e| e.to_string())?;
        std::fs::remove_file(&tmp_path).ok();

        // love-android 源码归档有顶层目录 love-android-{tag}/，拉平到 dest_dir。
        if platform == "android-template" {
            flatten_single_subdir(&dest_dir).map_err(|e| e.to_string())?;

            // love-android 的 love/ 子目录是 git submodule，不包含在 zip 归档中。
            // 需单独下载 love2d/love 同版本源码并解压到 love/ 目录，
            // 否则 NDK 构建会报 "Missing LOVE" 错误。
            let love_src_url = format!(
                "https://github.com/love2d/love/archive/refs/tags/{version}.zip"
            );

            let resp2 = client.get(&love_src_url).send().await.map_err(|e| e.to_string())?;
            let total2 = resp2.content_length().unwrap_or(0);
            let tmp2 = dest_dir.join("love_src.zip");
            let mut f2 = std::fs::File::create(&tmp2).map_err(|e| e.to_string())?;

            let mut dl2 = 0u64;
            let mut stream2 = resp2.bytes_stream();
            while let Some(chunk) = stream2.next().await {
                let chunk = chunk.map_err(|e| e.to_string())?;
                f2.write_all(&chunk).map_err(|e| e.to_string())?;
                dl2 += chunk.len() as u64;
                let pct = if total2 > 0 { dl2 as f64 / total2 as f64 * 100.0 } else { 0.0 };
                let _ = app.emit("download-progress", DownloadProgress {
                    version: version.clone(), platform: platform.clone(),
                    downloaded: dl2, total: total2, percent: pct,
                });
            }
            drop(f2);

            // love/ 是 love-android 的 Android Gradle 模块，不能替换。
            // LÖVE C 源码子模块位于 love/src/jni/love/（在 zip 归档中是空目录）。
            // 将 love2d/love 源码解压到该路径。
            let love_submod = dest_dir.join("love").join("src").join("jni").join("love");
            if love_submod.exists() {
                std::fs::remove_dir_all(&love_submod).ok();
            }
            std::fs::create_dir_all(&love_submod).map_err(|e| e.to_string())?;
            extract_zip(&tmp2, &love_submod).map_err(|e| e.to_string())?;
            std::fs::remove_file(&tmp2).ok();
            flatten_single_subdir(&love_submod).map_err(|e| e.to_string())?;
        }
    }

    let _ = app.emit("download-progress", DownloadProgress {
        version: version.clone(), platform: platform.clone(),
        downloaded, total, percent: 100.0,
    });
    Ok(())
}

// ── 构建游戏 ───────────────────────────────────────────────

#[tauri::command]
pub async fn build_game(
    app: AppHandle,
    config: ProjectConfig,
    runtime_dir: Option<String>,
    default_output_dir: Option<String>,
    android_sdk_dir: Option<String>,
    jdk17_dir: Option<String>,
    keystore_path: Option<String>,
    keystore_password: Option<String>,
    keystore_key_alias: Option<String>,
    keystore_key_password: Option<String>,
) -> Result<(), String> {
    emit_log(&app, "[INFO] 开始构建…");

    // love-android 模板：{runtimeDir}/{love2d_version}/android-template/
    let derived_love_android = runtime_cache::runtime_dir_for(
        &config.love2d_version, "android-template", runtime_dir.as_deref()
    ).to_string_lossy().to_string();

    let love_path = pack_love_file(&app, &config, runtime_dir.as_deref())
        .map_err(|e| e.to_string())?;
    emit_log(&app, &format!("[OK] .love 已生成: {}", love_path.display()));

    for target in &config.targets {
        if !target.enabled { continue; }
        emit_log(&app, &format!("[INFO] 构建 {}…", target.platform));
        emit_progress(&app, &target.platform, "running", "构建中…");
        let result = match target.platform.as_str() {
            "windows" => build_windows(&app, &config, &love_path, runtime_dir.as_deref(), default_output_dir.as_deref()).await,
            "linux"   => build_linux(&app, &config, &love_path, default_output_dir.as_deref()),
            "android" => build_android(
                &app, &config, &love_path, default_output_dir.as_deref(),
                Some(&derived_love_android), android_sdk_dir.as_deref(), jdk17_dir.as_deref(),
                keystore_path.as_deref(), keystore_password.as_deref(),
                keystore_key_alias.as_deref(), keystore_key_password.as_deref(),
            ).await,
            p => Err(anyhow::anyhow!("平台 {p} 暂未支持")),
        };
        match result {
            Ok(_)  => {
                emit_log(&app, &format!("[OK] {} 构建成功", target.platform));
                emit_progress(&app, &target.platform, "success", "构建成功");
            }
            Err(e) => {
                emit_log(&app, &format!("[ERROR] {} 构建失败: {e}", target.platform));
                emit_progress(&app, &target.platform, "error", &e.to_string());
            }
        }
    }

    emit_log(&app, "[INFO] 全部构建完成");
    Ok(())
}

// ── .love 打包（含内置 LuaJIT 编译）─────────────────────────

fn pack_love_file(app: &AppHandle, config: &ProjectConfig, runtime_dir: Option<&str>) -> Result<PathBuf> {
    let source = Path::new(&config.source_path);
    if !source.join("main.lua").exists() {
        anyhow::bail!("源目录中找不到 main.lua");
    }

    let out_dir = std::env::temp_dir().join("love2dhub_build");
    std::fs::create_dir_all(&out_dir)?;
    let love_path = out_dir.join(format!("{}.love", config.name));

    let zip_source: PathBuf = if config.compile_lua {
        emit_log(app, "[INFO] 正在用内置 LuaJIT 编译 .lua 文件…");
        match compile_with_love_runtime(app, source, &config.love2d_version, runtime_dir) {
            Ok(staged) => {
                emit_log(app, "[OK] LuaJIT 字节码编译完成");
                staged
            }
            Err(e) => {
                emit_log(app, &format!("[WARN] LuaJIT 编译失败: {e}"));
                emit_log(app, "[WARN] 降级为打包原始 Lua 源码");
                source.to_path_buf()
            }
        }
    } else {
        source.to_path_buf()
    };

    let file = std::fs::File::create(&love_path)?;
    let mut zip = zip::ZipWriter::new(file);
    let opts = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    zip_dir(&mut zip, &zip_source, &zip_source, &opts)?;
    zip.finish()?;

    Ok(love_path)
}

// ── 内置 LuaJIT 编译实现 ───────────────────────────────────

fn compile_with_love_runtime(
    app: &AppHandle,
    source: &Path,
    love2d_version: &str,
    runtime_dir: Option<&str>,
) -> Result<PathBuf> {
    let love_exe = find_love_exe_for_host(love2d_version, runtime_dir)
        .map_err(|_| anyhow::anyhow!(
            "未找到 {} 的当前平台运行时，请在「版本管理」中下载", love2d_version
        ))?;

    let helper_dir = std::env::temp_dir().join("love2dhub_compiler");
    std::fs::create_dir_all(&helper_dir)?;
    std::fs::write(helper_dir.join("main.lua"), LUAC_MAIN)?;
    std::fs::write(helper_dir.join("conf.lua"), LUAC_CONF)?;

    let lua_files = collect_lua_files_relative(source)?;
    if lua_files.is_empty() {
        let staging = std::env::temp_dir().join("love2dhub_staged");
        if staging.exists() { std::fs::remove_dir_all(&staging)?; }
        copy_dir(source, &staging)?;
        return Ok(staging);
    }

    emit_log(app, &format!("  找到 {} 个 .lua 文件，开始编译", lua_files.len()));

    let manifest_path = std::env::temp_dir().join("love2dhub_manifest.txt");
    std::fs::write(&manifest_path, lua_files.join("\n"))?;

    let staging = std::env::temp_dir().join("love2dhub_staged");
    if staging.exists() { std::fs::remove_dir_all(&staging)?; }
    std::fs::create_dir_all(&staging)?;

    copy_non_lua_files(source, &staging)?;

    let result = std::process::Command::new(&love_exe)
        .arg(&helper_dir)
        .env("LOVE2DHUB_SRC",      source.to_str().unwrap())
        .env("LOVE2DHUB_OUT",      staging.to_str().unwrap())
        .env("LOVE2DHUB_MANIFEST", manifest_path.to_str().unwrap())
        .output();

    std::fs::remove_file(&manifest_path).ok();

    let output = result.map_err(|e| anyhow::anyhow!("无法启动 love 运行时: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() { continue; }
        let log = if line.starts_with("OK ")   { format!("  ✓ {}", &line[3..]) }
                  else if line.starts_with("FAIL ") { format!("  ✗ {}", &line[5..]) }
                  else { format!("  {line}") };
        emit_log(app, &log);
    }

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("{}", stderr.trim());
    }

    Ok(staging)
}

/// 查找当前宿主平台对应的 Love2D 可执行文件
fn find_love_exe_for_host(version: &str, runtime_dir: Option<&str>) -> Result<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let dir = runtime_cache::runtime_dir_for(version, "windows", runtime_dir);
        let direct = dir.join("love.exe");
        if direct.exists() { return Ok(direct); }
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for e in entries.flatten() {
                let candidate = e.path().join("love.exe");
                if candidate.exists() { return Ok(candidate); }
            }
        }
        anyhow::bail!("未找到 love.exe");
    }
    #[cfg(target_os = "macos")]
    {
        let dir = runtime_cache::runtime_dir_for(version, "macos", runtime_dir);
        let exe = dir.join("love.app/Contents/MacOS/love");
        if exe.exists() { return Ok(exe); }
        anyhow::bail!("未找到 love (macOS)");
    }
    #[cfg(target_os = "linux")]
    {
        let dir = runtime_cache::runtime_dir_for(version, "linux", runtime_dir);
        let appimage = dir.join(format!("love-{version}-x86_64.AppImage"));
        if appimage.exists() { return Ok(appimage); }
        anyhow::bail!("未找到 love (Linux)");
    }
}

fn collect_lua_files_relative(dir: &Path) -> Result<Vec<String>> {
    let mut files = vec![];
    collect_lua_recursive(dir, dir, &mut files)?;
    files.sort();
    Ok(files)
}

fn collect_lua_recursive(base: &Path, dir: &Path, out: &mut Vec<String>) -> Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            collect_lua_recursive(base, &path, out)?;
        } else if path.extension().and_then(|e| e.to_str()) == Some("lua") {
            let rel = path.strip_prefix(base)?.to_string_lossy().replace('\\', "/");
            out.push(rel);
        }
    }
    Ok(())
}

fn copy_non_lua_files(src: &Path, dst: &Path) -> Result<()> {
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let dest = dst.join(entry.file_name());
        if path.is_dir() {
            std::fs::create_dir_all(&dest)?;
            copy_non_lua_files(&path, &dest)?;
        } else if path.extension().and_then(|e| e.to_str()) != Some("lua") {
            std::fs::copy(&path, &dest)?;
        }
    }
    Ok(())
}

// ── 各平台打包 ─────────────────────────────────────────────

async fn build_windows(
    app: &AppHandle,
    config: &ProjectConfig,
    love_path: &Path,
    runtime_dir: Option<&str>,
    default_output_dir: Option<&str>,
) -> Result<()> {
    let rt_dir = runtime_cache::runtime_dir_for(&config.love2d_version, "windows", runtime_dir);

    let love_exe = find_file_in_dir(&rt_dir, "love.exe")
        .ok_or_else(|| anyhow::anyhow!("找不到 love.exe，请先下载 Windows 运行时"))?;
    let runtime_parent = love_exe.parent().unwrap();

    let out_dir = resolve_output_dir(&config.name, "windows", default_output_dir);
    std::fs::create_dir_all(&out_dir)?;

    let exe_path = out_dir.join(format!("{}.exe", config.name));

    // ── 嵌入图标（必须在拼接 .love 之前，rcedit 会重写 PE 结构）──
    let icon_src = Path::new(&config.icon_path);
    if !config.icon_path.is_empty() && icon_src.exists() {
        emit_log(app, "  正在嵌入 exe 图标…");
        // 先把 love.exe 复制到目标路径，rcedit 只修改 PE 资源
        std::fs::copy(&love_exe, &exe_path)?;
        match embed_windows_icon(app, &exe_path, icon_src).await {
            Ok(_)  => emit_log(app, "  ✓ 图标已嵌入"),
            Err(e) => {
                emit_log(app, &format!("  [WARN] 图标嵌入失败（不影响运行）: {e}"));
                // 嵌入失败时回退：直接用原始 love.exe
                std::fs::copy(&love_exe, &exe_path)?;
            }
        }
    } else {
        std::fs::copy(&love_exe, &exe_path)?;
    }

    // ── 追加 .love（必须在图标嵌入之后）──────────────────────
    let mut f = std::fs::OpenOptions::new().append(true).open(&exe_path)?;
    std::io::Write::write_all(&mut f, &std::fs::read(love_path)?)?;
    drop(f);

    let mut dll_count = 0;
    for entry in std::fs::read_dir(runtime_parent)? {
        let entry = entry?;
        if entry.path().extension().and_then(|e| e.to_str()) == Some("dll") {
            std::fs::copy(entry.path(), out_dir.join(entry.file_name()))?;
            dll_count += 1;
        }
    }
    emit_log(app, &format!("  exe: {}  ({dll_count} DLL)", exe_path.display()));
    Ok(())
}


async fn build_android(
    app: &AppHandle,
    config: &ProjectConfig,
    love_path: &Path,
    default_output_dir: Option<&str>,
    love_android_dir: Option<&str>,
    android_sdk_dir: Option<&str>,
    jdk17_dir: Option<&str>,
    keystore_path: Option<&str>,
    keystore_password: Option<&str>,
    keystore_key_alias: Option<&str>,
    keystore_key_password: Option<&str>,
) -> Result<()> {
    use tokio::io::AsyncBufReadExt;

    // ── 前置检查 ───────────────────────────────────────────
    let template_str = love_android_dir
        .filter(|s| !s.is_empty())
        .ok_or_else(|| anyhow::anyhow!("无法确定 love-android 模板路径，请确认已设置运行时目录"))?;
    let template = PathBuf::from(template_str);
    if !template.exists() {
        anyhow::bail!(
            "找不到对应版本的 love-android 模板：{}\n请前往「设置 → Android 构建环境」下载对应版本的模板",
            template.display()
        );
    }

    let sdk = android_sdk_dir
        .filter(|s| !s.is_empty())
        .ok_or_else(|| anyhow::anyhow!("请在「设置 → Android 构建环境」中配置 Android SDK 目录"))?;

    let gradlew = if cfg!(target_os = "windows") {
        template.join("gradlew.bat")
    } else {
        template.join("gradlew")
    };
    if !gradlew.exists() {
        anyhow::bail!("在模板目录中找不到 gradlew：{}", gradlew.display());
    }

    // ── 1. 写入 game.love ──────────────────────────────────
    let assets_dir = template.join("app").join("src").join("embed").join("assets");
    std::fs::create_dir_all(&assets_dir)?;
    std::fs::copy(love_path, assets_dir.join("game.love"))?;
    emit_log(app, "[OK] game.love 已写入 embed/assets/");

    // ── 2. 写入 local.properties（Android SDK 路径）────────
    let local_props = template.join("local.properties");
    let sdk_escaped = sdk.replace('\\', "\\\\");
    std::fs::write(&local_props, format!("sdk.dir={sdk_escaped}\n"))?;
    emit_log(app, &format!("[OK] local.properties 已写入 sdk.dir={sdk}"));

    // ── 3. 确定 Application ID ─────────────────────────────
    let app_id = if !config.android_app_id.is_empty() {
        config.android_app_id.clone()
    } else {
        let slug: String = config.name
            .to_lowercase()
            .chars()
            .map(|c| if c.is_alphanumeric() { c } else { '_' })
            .collect();
        format!("org.love2d.{slug}")
    };
    emit_log(app, &format!("[INFO] Application ID: {app_id}"));

    // ── 4. 计算 version_code ───────────────────────────────
    let parts: Vec<u32> = config.version
        .split('.')
        .filter_map(|s| s.parse().ok())
        .collect();
    let version_code = (parts.first().copied().unwrap_or(1) * 10_000
        + parts.get(1).copied().unwrap_or(0) * 100
        + parts.get(2).copied().unwrap_or(0))
    .max(1);

    // ── 5. 覆写 gradle.properties ──────────────────────────
    // 通过直接修改文件设置应用名、包名、版本，避免命令行 -P 与文件中
    // app.name_byte_array 同时存在导致 Gradle 抛出异常。
    // 名称统一使用 UTF-8 字节数组，兼容中文等非 ASCII 字符。
    {
        let name_bytes = config.name.as_bytes()
            .iter().map(|b| b.to_string()).collect::<Vec<_>>().join(",");
        let gradle_props = format!(
            "app.name_byte_array={name_bytes}\n\
             app.application_id={app_id}\n\
             app.orientation=landscape\n\
             app.version_code={version_code}\n\
             app.version_name={version_name}\n\
             \n\
             # No need to modify anything past this line!\n\
             android.enableJetifier=false\n\
             android.useAndroidX=true\n\
             android.defaults.buildfeatures.buildconfig=true\n\
             android.nonTransitiveRClass=true\n\
             android.nonFinalResIds=true\n",
            name_bytes = name_bytes,
            app_id = app_id,
            version_code = version_code,
            version_name = config.version,
        );
        std::fs::write(template.join("gradle.properties"), gradle_props)?;
        emit_log(app, &format!("[OK] gradle.properties 已更新（应用名: {}）", config.name));
    }

    // ── 5.5 覆写启动图标 ───────────────────────────────────────
    if !config.icon_path.is_empty() {
        let icon_src = Path::new(&config.icon_path);
        if icon_src.exists() {
            emit_log(app, "[INFO] 正在写入 Android 启动图标…");
            match set_android_launcher_icon(&template, icon_src) {
                Ok(logs) => {
                    for line in &logs { emit_log(app, line); }
                    emit_log(app, "[OK] Android 启动图标已全部写入");
                }
                Err(e) => emit_log(app, &format!("[WARN] Android 图标写入失败（不影响构建）: {e}")),
            }
        } else {
            emit_log(app, &format!("[WARN] 图标文件不存在，跳过: {}", config.icon_path));
        }
    }

    // ── 6. 启动 Gradle ─────────────────────────────────────
    // 有 keystore → release（正式签名，可上传应用商店）
    // 无 keystore → debug（SDK 自动签名，可直接侧载安装）
    let use_release = keystore_path.filter(|s| !s.is_empty()).is_some();
    let gradle_task = if use_release {
        "assembleEmbedNoRecordRelease"
    } else {
        "assembleEmbedNoRecordDebug"
    };
    emit_log(app, &format!(
        "[INFO] 启动 Gradle 构建（{}，首次运行需下载依赖，可能需要数分钟）…",
        if use_release { "release 签名" } else { "debug 签名" }
    ));

    let mut cmd = tokio::process::Command::new(&gradlew);
    cmd.current_dir(&template)
        .arg(gradle_task)
        // 禁用配置缓存：避免 Gradle 脚本缓存因 JDK 版本切换导致 class file 版本不兼容
        .arg("--no-configuration-cache")
        // 不使用长驻 daemon，避免 daemon 与当前 JDK 版本不匹配
        .arg("--no-daemon")
        .env("ANDROID_HOME", sdk)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    if let Some(jdk) = jdk17_dir.filter(|s| !s.is_empty()) {
        cmd.env("JAVA_HOME", jdk);
        // 确保 JDK bin 目录在 PATH 最前面，覆盖系统 JDK
        #[cfg(target_os = "windows")]
        {
            let jdk_bin = format!("{jdk}\\bin");
            if let Ok(path) = std::env::var("PATH") {
                cmd.env("PATH", format!("{jdk_bin};{path}"));
            }
        }
        #[cfg(not(target_os = "windows"))]
        {
            let jdk_bin = format!("{jdk}/bin");
            if let Ok(path) = std::env::var("PATH") {
                cmd.env("PATH", format!("{jdk_bin}:{path}"));
            }
        }
    }

    // release 签名：通过标准 Android Gradle 注入属性传递 keystore 信息
    if use_release {
        let ks_path   = keystore_path.unwrap();
        let ks_pass   = keystore_password.unwrap_or("");
        let ks_alias  = keystore_key_alias.unwrap_or("");
        let key_pass  = if keystore_key_password.unwrap_or("").is_empty() {
            ks_pass
        } else {
            keystore_key_password.unwrap()
        };
        cmd.arg(format!("-Pandroid.injected.signing.store.file={ks_path}"))
           .arg(format!("-Pandroid.injected.signing.store.password={ks_pass}"))
           .arg(format!("-Pandroid.injected.signing.key.alias={ks_alias}"))
           .arg(format!("-Pandroid.injected.signing.key.password={key_pass}"));
    }

    let mut child = cmd.spawn()
        .map_err(|e| anyhow::anyhow!("无法启动 gradlew：{e}"))?;

    // 流式转发 stdout（Gradle 任务进度）
    if let Some(stdout) = child.stdout.take() {
        let app2 = app.clone();
        tokio::spawn(async move {
            let mut lines = tokio::io::BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let line = line.trim().to_string();
                if line.is_empty() { continue; }
                // NDK 编译器警告也可能经由 Gradle stdout 输出，同样过滤
                if line.starts_with("C/C++:") && !line.contains(" error:") { continue; }
                if line.ends_with("warnings generated.") || line.ends_with("warning generated.") { continue; }
                let _ = app2.emit("build-log", format!("[GRADLE] {line}"));
            }
        });
    }
    // 流式转发 stderr，并检测常见错误
    if let Some(stderr) = child.stderr.take() {
        let app2 = app.clone();
        tokio::spawn(async move {
            let mut lines = tokio::io::BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let line = line.trim().to_string();
                if line.is_empty() { continue; }

                // 过滤 NDK C/C++ 编译器警告（非错误）：这些来自 LÖVE 第三方库，
                // 数量极多且无法修复，只保留真正的 error 行。
                if line.starts_with("C/C++:") && !line.contains(" error:") {
                    continue;
                }
                // 过滤 "N warnings generated." 汇总行
                if line.ends_with("warnings generated.") || line.ends_with("warning generated.") {
                    continue;
                }

                let _ = app2.emit("build-log", format!("[GRADLE] {line}"));
                // 检测 JDK class file 版本不兼容
                if line.contains("Unsupported class file major version") {
                    let _ = app2.emit("build-log",
                        "[WARN] 检测到 Gradle 脚本缓存与当前 JDK 版本不兼容。\
                        请删除 %USERPROFILE%\\.gradle\\caches 目录后重试，\
                        或在设置中指定 JDK 17 路径以覆盖系统默认 JDK。");
                }
            }
        });
    }

    let status = child.wait().await?;
    if !status.success() {
        anyhow::bail!("Gradle 构建失败，退出码 {:?}，请查看上方日志", status.code());
    }

    // ── 7. 找到输出 APK 并复制 ────────────────────────────
    let apk_variant = if use_release { "release" } else { "debug" };
    let apk_dir = template
        .join("app")
        .join("build")
        .join("outputs")
        .join("apk")
        .join("embedNoRecord")
        .join(apk_variant);

    let apk_src = std::fs::read_dir(&apk_dir)
        .map_err(|_| anyhow::anyhow!("找不到 Gradle 输出目录：{}", apk_dir.display()))?
        .flatten()
        .find(|e| e.path().extension().and_then(|x| x.to_str()) == Some("apk"))
        .map(|e| e.path())
        .ok_or_else(|| anyhow::anyhow!("输出目录中没有 APK，请检查构建日志"))?;

    let out_dir = resolve_output_dir(&config.name, "android", default_output_dir);
    std::fs::create_dir_all(&out_dir)?;

    let apk_dest = out_dir.join(format!("{}.apk", config.name));
    std::fs::copy(&apk_src, &apk_dest)?;
    emit_log(app, &format!("[OK] APK: {}", apk_dest.display()));
    Ok(())
}

fn build_linux(
    app: &AppHandle,
    config: &ProjectConfig,
    love_path: &Path,
    default_output_dir: Option<&str>,
) -> Result<()> {
    let out_dir = resolve_output_dir(&config.name, "linux", default_output_dir);
    std::fs::create_dir_all(&out_dir)?;
    std::fs::copy(love_path, out_dir.join(format!("{}.love", config.name)))?;
    let script_path = out_dir.join(&config.name);
    std::fs::write(&script_path, format!("#!/bin/sh\nlove \"{}.love\" \"$@\"\n", config.name))?;
    #[cfg(unix)] {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&script_path, std::fs::Permissions::from_mode(0o755))?;
    }
    emit_log(app, &format!("  输出: {}", out_dir.display()));
    Ok(())
}

// ── 已打包程序管理 ─────────────────────────────────────────

/// 扫描已打包游戏。
/// 目录结构：{buildDir}/{gameName}/{platform}/files
/// 遍历 buildDir 下所有游戏子目录，再按平台过滤。
#[tauri::command]
pub fn list_packages(
    platforms: Vec<String>,
    default_output_dir: Option<String>,
) -> Result<Vec<PackagedGame>, String> {
    let base = build_base_dir(default_output_dir.as_deref());
    if !base.exists() { return Ok(vec![]); }

    let mut games = vec![];

    // 遍历 buildDir 下每个游戏名目录
    let game_dirs = match std::fs::read_dir(&base) {
        Ok(d) => d,
        Err(_) => return Ok(vec![]),
    };

    for game_entry in game_dirs.flatten() {
        let game_dir = game_entry.path();
        if !game_dir.is_dir() { continue; }

        for platform in &platforms {
            let platform_dir = game_dir.join(platform);
            if !platform_dir.exists() { continue; }

            let entries = match std::fs::read_dir(&platform_dir) {
                Ok(e) => e,
                Err(_) => continue,
            };

            for entry in entries.flatten() {
                let path = entry.path();
                let ext = path.extension().and_then(|e| e.to_str());
                let matched = match platform.as_str() {
                    "windows" => ext == Some("exe"),
                    "macos"   => ext == Some("app"),
                    "linux"   => ext == Some("love"),
                    "android" => ext == Some("apk"),
                    _         => false,
                };
                if !matched { continue; }

                let name = path.file_stem()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                let meta = path.metadata().ok();
                let size = if path.is_dir() {
                    dir_size_shallow(&path)
                } else {
                    meta.as_ref().map(|m| m.len()).unwrap_or(0)
                };
                let modified_time = meta
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0);

                games.push(PackagedGame {
                    name,
                    platform: platform.clone(),
                    path: path.to_string_lossy().to_string(),
                    output_dir: platform_dir.to_string_lossy().to_string(),
                    size,
                    modified_time,
                });
            }
        }
    }
    Ok(games)
}

fn dir_size_shallow(path: &Path) -> u64 {
    std::fs::read_dir(path)
        .map(|rd| rd.flatten().map(|e| e.metadata().map(|m| m.len()).unwrap_or(0)).sum())
        .unwrap_or(0)
}

/// 运行已打包的游戏（仅限当前宿主平台对应的格式）
#[tauri::command]
pub fn run_package(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("文件不存在: {path}"));
    }

    #[cfg(target_os = "windows")]
    {
        if p.extension().and_then(|e| e.to_str()) == Some("exe") {
            std::process::Command::new(&p)
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            return Err("当前为 Windows 系统，只能运行 .exe 文件".to_string());
        }
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&p)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new(&p)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 打开已打包游戏所在目录
#[tauri::command]
pub fn open_package_dir(output_dir: String) -> Result<(), String> {
    let p = PathBuf::from(&output_dir);
    if !p.exists() {
        return Err(format!("目录不存在: {output_dir}"));
    }
    open_in_explorer(&p)
}

/// 通用"在文件管理器中打开"命令，目录不存在时自动创建
#[tauri::command]
pub fn open_path(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        std::fs::create_dir_all(&p).map_err(|e| e.to_string())?;
    }
    open_in_explorer(&p)
}

/// 删除单个已打包游戏文件（.exe / .app bundle / .love）
#[tauri::command]
pub fn delete_package(path: String, platform: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Ok(());
    }
    match platform.as_str() {
        "macos" => {
            std::fs::remove_dir_all(&p).map_err(|e| e.to_string())?;
        }
        "linux" => {
            std::fs::remove_file(&p).map_err(|e| e.to_string())?;
            let script = p.with_extension("");
            if script.exists() { std::fs::remove_file(&script).ok(); }
        }
        "android" => {
            std::fs::remove_file(&p).map_err(|e| e.to_string())?;
            let love_file = p.with_extension("love");
            if love_file.exists() { std::fs::remove_file(&love_file).ok(); }
        }
        _ => {
            std::fs::remove_file(&p).map_err(|e| e.to_string())?;
        }
    }

    // 平台目录为空则删除，再检查游戏目录
    fn remove_if_empty(dir: &Path) {
        if dir.is_dir() {
            let empty = std::fs::read_dir(dir)
                .map(|mut d| d.next().is_none())
                .unwrap_or(false);
            if empty { std::fs::remove_dir(dir).ok(); }
        }
    }

    if let Some(platform_dir) = p.parent() {
        remove_if_empty(platform_dir);
        if let Some(game_dir) = platform_dir.parent() {
            remove_if_empty(game_dir);
        }
    }

    Ok(())
}

/// 打开指定版本的运行时目录（包含所有已下载平台的父目录）
#[tauri::command]
pub fn open_runtime_version_dir(version: String, runtime_dir: Option<String>) -> Result<(), String> {
    let dir = runtime_cache::runtimes_dir_for(runtime_dir.as_deref()).join(&version);
    std::fs::create_dir_all(&dir).ok();
    open_in_explorer(&dir)
}

/// 返回两个默认目录的实际路径：(runtimes, builds)
#[tauri::command]
pub fn get_default_dirs() -> (String, String) {
    let base = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("love2dhub");
    (
        base.join("runtimes").to_string_lossy().to_string(),
        base.join("builds").to_string_lossy().to_string(),
    )
}


/// 读取任意本地文件，返回 base64 编码的 data URL（用于前端图片预览）
#[tauri::command]
pub fn read_file_as_data_url(path: String) -> Result<String, String> {
    use std::io::Read;
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err(format!("文件不存在: {path}"));
    }
    let ext = p.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "gif"          => "image/gif",
        "webp"         => "image/webp",
        "ico"          => "image/x-icon",
        _              => "image/png",
    };
    let mut buf = Vec::new();
    std::fs::File::open(p)
        .and_then(|mut f| { f.read_to_end(&mut buf).map(|_| ()) })
        .map_err(|e| e.to_string())?;
    let b64 = encode_base64(&buf);
    Ok(format!("data:{mime};base64,{b64}"))
}

/// 返回当前宿主平台字符串，用于前端判断是否可以运行特定格式
#[tauri::command]
pub fn get_host_platform() -> String {
    #[cfg(target_os = "windows")] { "windows".to_string() }
    #[cfg(target_os = "macos")]   { "macos".to_string() }
    #[cfg(target_os = "linux")]   { "linux".to_string() }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    { "unknown".to_string() }
}

// ── 工具函数 ───────────────────────────────────────────────

fn emit_log(app: &AppHandle, msg: &str) {
    let _ = app.emit("build-log", msg);
}

fn emit_progress(app: &AppHandle, platform: &str, status: &str, message: &str) {
    let _ = app.emit("build-progress", serde_json::json!({
        "platform": platform,
        "status": status,
        "message": message,
    }));
}

/// 返回构建根目录（不含游戏名和平台）
/// 优先级：custom_default → %APPDATA%/love2dhub/builds
fn build_base_dir(custom_default: Option<&str>) -> PathBuf {
    match custom_default {
        Some(dir) if !dir.is_empty() => PathBuf::from(dir),
        _ => dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("love2dhub")
            .join("builds"),
    }
}

/// 最终确定某平台的输出目录。
/// 结构：{buildDir}/{gameName}/{platform}/
fn effective_output_dir(game_name: &str, platform: &str, custom_default: Option<&str>) -> PathBuf {
    build_base_dir(custom_default).join(game_name).join(platform)
}

fn resolve_output_dir(game_name: &str, platform: &str, default_output_dir: Option<&str>) -> PathBuf {
    effective_output_dir(game_name, platform, default_output_dir)
}

/// 标准 base64 编码（不依赖外部 crate）
fn encode_base64(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = if chunk.len() > 1 { chunk[1] as usize } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as usize } else { 0 };
        out.push(CHARS[b0 >> 2] as char);
        out.push(CHARS[((b0 & 3) << 4) | (b1 >> 4)] as char);
        out.push(if chunk.len() > 1 { CHARS[((b1 & 0xf) << 2) | (b2 >> 6)] as char } else { '=' });
        out.push(if chunk.len() > 2 { CHARS[b2 & 0x3f] as char } else { '=' });
    }
    out
}

// ── 图标处理 ──────────────────────────────────────────────────

/// 把任意 PNG 包装成 Vista+ 兼容的单图 ICO（无需外部库解码）
fn png_to_ico_bytes(png_path: &Path) -> Result<Vec<u8>> {
    let png = std::fs::read(png_path)?;
    let mut ico = Vec::with_capacity(22 + png.len());
    // ICONDIR
    ico.extend_from_slice(&[0u8, 0]);       // reserved
    ico.extend_from_slice(&[1u8, 0]);       // type: 1 = ICO
    ico.extend_from_slice(&[1u8, 0]);       // count: 1 image
    // ICONDIRENTRY
    ico.push(0); ico.push(0);               // width=0 → 256, height=0 → 256
    ico.push(0); ico.push(0);               // color count, reserved
    ico.extend_from_slice(&1u16.to_le_bytes());  // planes
    ico.extend_from_slice(&32u16.to_le_bytes()); // bit depth
    ico.extend_from_slice(&(png.len() as u32).to_le_bytes()); // image size
    ico.extend_from_slice(&22u32.to_le_bytes()); // data offset (6+16)
    ico.extend_from_slice(&png);
    Ok(ico)
}

/// 下载 rcedit-x64.exe（首次使用时一次性操作，缓存在 love2dhub/tools/）
async fn ensure_rcedit() -> Result<PathBuf> {
    let path = dirs::data_dir()
        .ok_or_else(|| anyhow::anyhow!("无法获取用户数据目录"))?
        .join("love2dhub").join("tools").join("rcedit-x64.exe");

    if path.exists() {
        return Ok(path);
    }
    std::fs::create_dir_all(path.parent().unwrap())?;

    let bytes = reqwest::get(
        "https://github.com/electron/rcedit/releases/latest/download/rcedit-x64.exe"
    ).await?.bytes().await?;
    std::fs::write(&path, &bytes)?;
    Ok(path)
}

/// 用 rcedit 把 ICO 嵌入 Windows exe（自动下载 rcedit，仅限 Windows 构建）
async fn embed_windows_icon(app: &AppHandle, exe_path: &Path, icon_src: &Path) -> Result<()> {
    let rcedit = ensure_rcedit().await
        .map_err(|e| anyhow::anyhow!("下载 rcedit 失败: {e}"))?;
    emit_log(app, "  rcedit 已就绪");

    // 如果图标不是 .ico，先包装成 ICO 格式
    let tmp_ico;
    let ico_path: &Path = if icon_src.extension().and_then(|e| e.to_str()) == Some("ico") {
        icon_src
    } else {
        let ico_data = png_to_ico_bytes(icon_src)?;
        tmp_ico = std::env::temp_dir().join("love2dhub_icon.ico");
        std::fs::write(&tmp_ico, ico_data)?;
        &tmp_ico
    };

    let status = std::process::Command::new(&rcedit)
        .arg(exe_path)
        .arg("--set-icon")
        .arg(ico_path)
        .status()?;

    if !status.success() {
        anyhow::bail!("rcedit 返回非零退出码");
    }
    Ok(())
}

/// 把用户图标缩放到所有 drawable 密度，覆盖模板中的 love.png
/// （AndroidManifest.xml 使用 @drawable/love 作为启动图标）
/// 返回每个文件的写入日志，供调用方 emit
fn set_android_launcher_icon(template: &Path, icon_src: &Path) -> Result<Vec<String>> {
    let mut logs = Vec::new();
    logs.push(format!("  图标源文件: {}", icon_src.display()));

    let img = image::open(icon_src)
        .map_err(|e| anyhow::anyhow!("无法打开图标文件（请确认是有效的 PNG/JPEG）: {e}"))?;

    let densities: &[(&str, u32)] = &[
        ("drawable-mdpi",    48),
        ("drawable-hdpi",    72),
        ("drawable-xhdpi",   96),
        ("drawable-xxhdpi",  144),
        ("drawable-xxxhdpi", 192),
    ];

    let res_base = template.join("app").join("src").join("main").join("res");
    logs.push(format!("  res 目录: {}", res_base.display()));

    for (dir, size) in densities {
        let out = res_base.join(dir).join("love.png");
        if let Some(parent) = out.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let resized = img.resize_exact(*size, *size, image::imageops::FilterType::Lanczos3);
        resized.save(&out)?;
        logs.push(format!("  ✓ {}x{} → {}", size, size, out.display()));
    }
    Ok(logs)
}

fn find_file_in_dir(dir: &Path, name: &str) -> Option<PathBuf> {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for e in entries.flatten() {
            let p = e.path();
            if p.is_dir() {
                if let Some(found) = find_file_in_dir(&p, name) { return Some(found); }
            } else if p.file_name().and_then(|n| n.to_str()) == Some(name) {
                return Some(p);
            }
        }
    }
    None
}


fn zip_dir(
    zip: &mut zip::ZipWriter<std::fs::File>,
    base: &Path,
    dir: &Path,
    opts: &zip::write::SimpleFileOptions,
) -> Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let rel = path.strip_prefix(base)?.to_string_lossy().replace('\\', "/");
        if path.is_dir() {
            zip_dir(zip, base, &path, opts)?;
        } else {
            zip.start_file(&rel, *opts)?;
            zip.write_all(&std::fs::read(&path)?)?;
        }
    }
    Ok(())
}

fn extract_zip(zip_path: &Path, dest: &Path) -> Result<()> {
    zip::ZipArchive::new(std::fs::File::open(zip_path)?)?.extract(dest)?;
    Ok(())
}

/// GitHub 源码归档解压后会有一个顶层目录（如 love-android-11.5a/）。
/// 此函数将该目录的内容移动到 dest 目录下，然后删除空的顶层目录。
fn flatten_single_subdir(dest: &Path) -> Result<()> {
    let inner = std::fs::read_dir(dest)?
        .filter_map(|e| e.ok())
        .find(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
        .map(|e| e.path())
        .ok_or_else(|| anyhow::anyhow!("解压后未找到顶层目录"))?;

    for entry in std::fs::read_dir(&inner)? {
        let entry = entry?;
        std::fs::rename(entry.path(), dest.join(entry.file_name()))?;
    }
    std::fs::remove_dir(&inner)?;
    Ok(())
}

fn copy_dir(src: &Path, dst: &Path) -> Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let dest = dst.join(entry.file_name());
        if entry.file_type()?.is_dir() { copy_dir(&entry.path(), &dest)?; }
        else { std::fs::copy(entry.path(), dest)?; }
    }
    Ok(())
}

fn resolve_download_url(version: &str, platform: &str) -> Option<String> {
    if platform == "android-template" {
        // love-android 发布 tag 格式：{version}a（如 11.5a）
        return Some(format!(
            "https://github.com/love2d/love-android/archive/refs/tags/{}a.zip",
            version
        ));
    }
    let base = format!("https://github.com/love2d/love/releases/download/{version}");
    let file = match platform {
        "windows" => format!("love-{version}-win64.zip"),
        "macos"   => format!("love-{version}-macos.zip"),
        "linux"   => format!("love-{version}-x86_64.AppImage"),
        "android" => format!("love-{version}-android.apk"),
        "ios"     => format!("love-{version}-ios.zip"),
        _ => return None,
    };
    Some(format!("{base}/{file}"))
}
