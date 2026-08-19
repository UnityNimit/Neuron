// frontend/src-tauri/src/lib.rs
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Child, Command as StdCommand, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, RunEvent, WindowEvent};

/// Global state holding the background Python process handle
#[derive(Clone, Default)]
pub struct BackendProcess(pub Arc<Mutex<Option<Child>>>);

/// Diagnostic File Logger (Writes to %TEMP%\neuron_boot.log)
fn log_boot(msg: &str) {
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(std::env::temp_dir().join("neuron_boot.log"))
    {
        let _ = writeln!(file, "[NEURON] {}", msg);
    }
}

/// Custom IPC Command to query the status of the Python backend
#[tauri::command]
async fn get_backend_status() -> Result<bool, String> {
    let client = reqwest::Client::new();
    match client.get("http://127.0.0.1:8000/health").send().await {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false),
    }
}

/// 🚀 DIRECT NATIVE OS PROCESS LAUNCHER (100% Reliable, Zero Sandbox Blocks)
fn spawn_backend_process(state: &BackendProcess) {
    log_boot("Starting native backend process launcher...");

    let mut candidate_paths: Vec<PathBuf> = Vec::new();

    // 1. Production Installed Paths (Next to Neuron.exe or in binaries/)
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            candidate_paths.push(exe_dir.join("neuron-backend.exe"));
            candidate_paths.push(exe_dir.join("binaries").join("neuron-backend.exe"));
            candidate_paths.push(exe_dir.join("neuron-backend-x86_64-pc-windows-msvc.exe"));
            candidate_paths.push(exe_dir.join("binaries").join("neuron-backend-x86_64-pc-windows-msvc.exe"));
        }
    }

    // 2. Development Paths (Relative to project root and frontend/)
    candidate_paths.push(PathBuf::from("binaries/neuron-backend-x86_64-pc-windows-msvc.exe"));
    candidate_paths.push(PathBuf::from("src-tauri/binaries/neuron-backend-x86_64-pc-windows-msvc.exe"));
    candidate_paths.push(PathBuf::from("../backend/dist/neuron-backend.exe"));

    for bin_path in &candidate_paths {
        if bin_path.exists() {
            log_boot(&format!("Found backend binary at: {:?}", bin_path));

            let mut cmd = StdCommand::new(bin_path);

            // Set working directory to the binary's directory
            if let Some(parent_dir) = bin_path.parent() {
                cmd.current_dir(parent_dir);
            }

            // Hide console window on Windows
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                cmd.creation_flags(CREATE_NO_WINDOW);
            }

            // Pipe output to %TEMP%\neuron_backend_runtime.log for debugging
            let log_out = OpenOptions::new()
                .create(true)
                .append(true)
                .open(std::env::temp_dir().join("neuron_backend_runtime.log"))
                .map(Stdio::from)
                .unwrap_or_else(|_| Stdio::null());

            let log_err = OpenOptions::new()
                .create(true)
                .append(true)
                .open(std::env::temp_dir().join("neuron_backend_runtime.log"))
                .map(Stdio::from)
                .unwrap_or_else(|_| Stdio::null());

            cmd.stdout(log_out)
               .stderr(log_err)
               .stdin(Stdio::null());

            match cmd.spawn() {
                Ok(child) => {
                    let pid = child.id();
                    log_boot(&format!("🟢 Native backend spawned successfully! (PID: {})", pid));

                    if let Ok(mut lock) = state.0.lock() {
                        *lock = Some(child);
                    }
                    start_health_probe();
                    return;
                }
                Err(err) => {
                    log_boot(&format!("Failed to spawn {:?}: {}", bin_path, err));
                }
            }
        }
    }

    log_boot("⚠️ Backend binary not found locally. Running in Web/Manual backend mode.");
}

/// Asynchronous health probe loop
fn start_health_probe() {
    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::new();
        let mut attempts = 0;
        while attempts < 60 {
            tokio::time::sleep(tokio::time::Duration::from_millis(250)).await;
            if let Ok(resp) = client.get("http://127.0.0.1:8000/health").send().await {
                if resp.status().is_success() {
                    log_boot("🟢 Health check PASSED: Backend is online at ws://127.0.0.1:8000/ws");
                    break;
                }
            }
            attempts += 1;
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let backend_state = BackendProcess::default();
    let state_clone = backend_state.clone();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(backend_state.clone())
        .invoke_handler(tauri::generate_handler![get_backend_status])
        .setup(move |_app| {
            // 🚀 Directly launch the backend executable
            spawn_backend_process(&state_clone);
            Ok(())
        })
        .on_window_event(move |_window, event| {
            if let WindowEvent::Destroyed = event {
                log_boot("Window closed. Terminating backend process tree...");
                if let Ok(mut lock) = backend_state.0.lock() {
                    if let Some(mut child) = lock.take() {
                        #[cfg(windows)]
                        {
                            use std::os::windows::process::CommandExt;
                            const CREATE_NO_WINDOW: u32 = 0x08000000;
                            let pid = child.id();
                            let mut kill_cmd = StdCommand::new("taskkill");
                            kill_cmd.args(&["/F", "/T", "/PID", &pid.to_string()])
                                    .creation_flags(CREATE_NO_WINDOW)
                                    .stdout(Stdio::null())
                                    .stderr(Stdio::null());
                            let _ = kill_cmd.spawn();
                        }
                        let _ = child.kill();
                    }
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |_app_handle, event| {
        if let RunEvent::Exit = event {
            log_boot("Neuron Application Exited.");
        }
    });
}