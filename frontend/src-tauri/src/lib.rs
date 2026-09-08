// frontend/src-tauri/src/lib.rs
use std::fs::OpenOptions;
use std::io::Write;
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command as StdCommand, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, RunEvent, State, WindowEvent};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Global thread-safe process tracker
#[derive(Clone, Default)]
pub struct ProcessState {
    pub tauri_child: Arc<Mutex<Option<CommandChild>>>,
    pub std_child: Arc<Mutex<Option<Child>>>,
    pub is_quitting: Arc<AtomicBool>,
}

/// 🚀 IMMEDIATE LOG FLUSHER (Writes to %TEMP%\neuron_debug.log)
fn log_debug(msg: &str) {
    let log_path = std::env::temp_dir().join("neuron_debug.log");
    println!("[NEURON DEBUG] {}", msg);

    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        let _ = writeln!(file, "[{}] {}", get_timestamp(), msg);
        let _ = file.flush();
    }
}

fn get_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let start = SystemTime::now();
    let since_the_epoch = start.duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}.{:03}", since_the_epoch.as_secs(), since_the_epoch.subsec_millis())
}

/// Check if backend port 8000 is already active
fn is_backend_running() -> bool {
    let addr: SocketAddr = "127.0.0.1:8000".parse().unwrap();
    TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok()
}

/// Terminate all backend processes cleanly and thoroughly
fn kill_all_backend_processes(state: &ProcessState) {
    log_debug("Initiating complete backend process termination...");

    if let Ok(mut lock) = state.tauri_child.lock() {
        if let Some(child) = lock.take() {
            let _ = child.kill();
        }
    }

    if let Ok(mut lock) = state.std_child.lock() {
        if let Some(mut child) = lock.take() {
            let _ = child.kill();
        }
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let _ = StdCommand::new("taskkill")
            .args(&["/F", "/IM", "neuron-backend.exe", "/T"])
            .creation_flags(CREATE_NO_WINDOW)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn();

        let _ = StdCommand::new("taskkill")
            .args(&["/F", "/IM", "neuron-backend-x86_64-pc-windows-msvc.exe", "/T"])
            .creation_flags(CREATE_NO_WINDOW)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn();
    }

    log_debug("Backend process termination signals dispatched.");
}

/// Custom IPC Command to query backend health
#[tauri::command]
async fn get_backend_status() -> Result<bool, String> {
    let client = reqwest::Client::new();
    match client.get("http://127.0.0.1:8000/health").send().await {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false),
    }
}

/// Custom IPC Command to completely quit Neuron and terminate the backend engine
#[tauri::command]
async fn quit_neuron_completely(app: AppHandle, state: State<'_, ProcessState>) -> Result<(), String> {
    log_debug("quit_neuron_completely command received from UI.");
    state.is_quitting.store(true, Ordering::SeqCst);
    kill_all_backend_processes(&state);
    app.exit(0);
    Ok(())
}

/// Custom IPC Command to restart the backend engine
#[tauri::command]
async fn restart_backend(app: AppHandle, state: State<'_, ProcessState>) -> Result<(), String> {
    log_debug("restart_backend command received.");
    kill_all_backend_processes(&state);
    tokio::time::sleep(Duration::from_millis(600)).await;
    let state_inner = (*state).clone();
    launch_backend_with_logging(&app, &state_inner);
    Ok(())
}

/// Multi-tier launcher with comprehensive logging
fn launch_backend_with_logging(app: &AppHandle, state: &ProcessState) {
    if is_backend_running() {
        log_debug("⚡ [INSTANT START] Backend is ALREADY running on port 8000. Skipping spawn!");
        return;
    }

    log_debug("=================================================");
    log_debug("🚀 STARTING NEURON BACKEND LAUNCH SEQUENCE");
    log_debug("=================================================");

    // -------------------------------------------------------------------------
    // TIER 1: Try Tauri 2.0 Sidecar Protocol
    // -------------------------------------------------------------------------
    log_debug("Attempting Tier 1: Tauri 2.0 Shell Plugin Sidecar ('neuron-backend')...");
    let sidecar_res = app.shell().sidecar("neuron-backend");

    match sidecar_res {
        Ok(sidecar_cmd) => {
            match sidecar_cmd.spawn() {
                Ok((mut rx, child)) => {
                    log_debug("Tier 1: Successfully spawned sidecar via Tauri Shell!");
                    if let Ok(mut lock) = state.tauri_child.lock() {
                        *lock = Some(child);
                    }

                    // Stream stdout/stderr directly into debug log
                    tauri::async_runtime::spawn(async move {
                        while let Some(event) = rx.recv().await {
                            match event {
                                CommandEvent::Stdout(bytes) => {
                                    let text = String::from_utf8_lossy(&bytes);
                                    log_debug(&format!("[PYTHON STDOUT] {}", text.trim()));
                                }
                                CommandEvent::Stderr(bytes) => {
                                    let text = String::from_utf8_lossy(&bytes);
                                    log_debug(&format!("[PYTHON STDERR] {}", text.trim()));
                                }
                                CommandEvent::Terminated(payload) => {
                                    log_debug(&format!("⚠️ [PYTHON TERMINATED] Exit Code: {:?}", payload.code));
                                    break;
                                }
                                _ => {}
                            }
                        }
                    });

                    start_health_probe();
                    return;
                }
                Err(err) => {
                    log_debug(&format!("Tier 1 spawn failed: {}", err));
                }
            }
        }
        Err(err) => {
            log_debug(&format!("Tier 1 sidecar resolution failed: {}", err));
        }
    }

    // -------------------------------------------------------------------------
    // TIER 2: Direct OS Executable Discovery
    // -------------------------------------------------------------------------
    log_debug("Falling back to Tier 2: Direct OS Executable Discovery...");

    let mut candidate_paths: Vec<PathBuf> = Vec::new();

    if let Ok(current_exe) = std::env::current_exe() {
        log_debug(&format!("Current executable location: {:?}", current_exe));
        if let Some(exe_dir) = current_exe.parent() {
            candidate_paths.push(exe_dir.join("neuron-backend.exe"));
            candidate_paths.push(exe_dir.join("neuron-backend-x86_64-pc-windows-msvc.exe"));
            candidate_paths.push(exe_dir.join("binaries").join("neuron-backend.exe"));
            candidate_paths.push(exe_dir.join("binaries").join("neuron-backend-x86_64-pc-windows-msvc.exe"));
        }
    }

    // Development fallback paths
    candidate_paths.push(PathBuf::from("binaries/neuron-backend-x86_64-pc-windows-msvc.exe"));
    candidate_paths.push(PathBuf::from("src-tauri/binaries/neuron-backend-x86_64-pc-windows-msvc.exe"));
    candidate_paths.push(PathBuf::from("../backend/dist/neuron-backend.exe"));

    for bin_path in &candidate_paths {
        let exists = bin_path.exists();
        log_debug(&format!("Checking candidate path: {:?} -> Exists: {}", bin_path, exists));

        if exists {
            log_debug(&format!("Found executable at {:?}. Spawning OS process...", bin_path));

            let mut cmd = StdCommand::new(bin_path);

            if let Some(parent_dir) = bin_path.parent() {
                cmd.current_dir(parent_dir);
                log_debug(&format!("Set child working directory to: {:?}", parent_dir));
            }

            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                cmd.creation_flags(CREATE_NO_WINDOW);
            }

            // Pipe output to log files for inspection
            let stdout_log = OpenOptions::new()
                .create(true)
                .append(true)
                .open(std::env::temp_dir().join("neuron_debug.log"))
                .map(Stdio::from)
                .unwrap_or_else(|_| Stdio::null());

            let stderr_log = OpenOptions::new()
                .create(true)
                .append(true)
                .open(std::env::temp_dir().join("neuron_debug.log"))
                .map(Stdio::from)
                .unwrap_or_else(|_| Stdio::null());

            cmd.stdout(stdout_log)
               .stderr(stderr_log)
               .stdin(Stdio::null());

            match cmd.spawn() {
                Ok(child) => {
                    let pid = child.id();
                    log_debug(&format!("🟢 Tier 2: Successfully spawned backend process! (PID: {})", pid));

                    if let Ok(mut lock) = state.std_child.lock() {
                        *lock = Some(child);
                    }

                    start_health_probe();
                    return;
                }
                Err(err) => {
                    log_debug(&format!("Tier 2: Failed spawning {:?}: {}", bin_path, err));
                }
            }
        }
    }

    log_debug("❌ [CRITICAL] All backend spawn attempts failed. Check paths in neuron_debug.log.");
}

/// Health check probe loop
fn start_health_probe() {
    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::new();
        let mut attempts = 0;
        while attempts < 60 {
            tokio::time::sleep(tokio::time::Duration::from_millis(250)).await;
            if let Ok(resp) = client.get("http://127.0.0.1:8000/health").send().await {
                if resp.status().is_success() {
                    log_debug("🟢 [SUCCESS] Backend health check PASSED! ws://127.0.0.1:8000/ws is online.");
                    break;
                }
            }
            attempts += 1;
        }

        if attempts >= 60 {
            log_debug("⚠️ [TIMEOUT] Backend did not respond to /health within 15 seconds.");
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let process_state = ProcessState::default();
    let state_setup = process_state.clone();
    let state_event = process_state.clone();
    let state_exit = process_state.clone();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .manage(process_state.clone())
        .invoke_handler(tauri::generate_handler![
            get_backend_status,
            quit_neuron_completely,
            restart_backend
        ])
        .setup(move |app| {
            let app_handle = app.handle().clone();

            // Maximize main window on launch to fit 1920x1080 and any display
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.maximize();
            }

            // Spawn backend engine
            launch_backend_with_logging(&app_handle, &state_setup);

            // Configure System Tray Menu
            let show_i = MenuItem::with_id(app, "show", "Open Neuron IDE", true, None::<&str>)?;
            let status_i = MenuItem::with_id(app, "status", "● Backend: Running (Port 8000)", false, None::<&str>)?;
            let restart_i = MenuItem::with_id(app, "restart", "Restart Backend Engine", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit Neuron Completely", true, None::<&str>)?;

            let tray_menu = Menu::with_items(app, &[&show_i, &status_i, &restart_i, &sep, &quit_i])?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .tooltip("Neuron IDE - Spatial Development Platform");

            // Attach default window icon if available
            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let state_tray = state_setup.clone();
            tray_builder
                .on_menu_event(move |app_h, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app_h.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                        "restart" => {
                            let state_inner = state_tray.clone();
                            let h = app_h.clone();
                            tauri::async_runtime::spawn(async move {
                                kill_all_backend_processes(&state_inner);
                                tokio::time::sleep(Duration::from_millis(600)).await;
                                launch_backend_with_logging(&h, &state_inner);
                            });
                        }
                        "quit" => {
                            state_tray.is_quitting.store(true, Ordering::SeqCst);
                            kill_all_backend_processes(&state_tray);
                            app_h.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app_h = tray.app_handle();
                        if let Some(window) = app_h.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(move |window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if !state_event.is_quitting.load(Ordering::SeqCst) {
                    // Prevent process kill; keep backend running in background
                    api.prevent_close();
                    let _ = window.hide();
                    log_debug("Main window closed to system tray. Backend continues running for instant reopen.");
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |_app_handle, event| {
        if let RunEvent::Exit = event {
            log_debug("Neuron Application Exiting. Ensuring all backend processes terminated...");
            kill_all_backend_processes(&state_exit);
        }
    });
}