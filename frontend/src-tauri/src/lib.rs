// frontend/src-tauri/src/lib.rs
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, RunEvent, WindowEvent};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Thread-safe storage for the background Python sidecar process
#[derive(Clone, Default)]
pub struct SidecarState(pub Arc<Mutex<Option<CommandChild>>>);

/// Custom IPC Command to query the status of the Python backend
#[tauri::command]
async fn get_backend_status() -> Result<bool, String> {
    let client = reqwest::Client::new();
    match client.get("http://127.0.0.1:8000/health").send().await {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false),
    }
}

/// Custom IPC Command to restart the Python sidecar on demand
#[tauri::command]
async fn restart_backend_sidecar(
    app: AppHandle,
    state: tauri::State<'_, SidecarState>,
) -> Result<String, String> {
    let mut lock = state.0.lock().map_err(|e| e.to_string())?;

    // Terminate existing sidecar process if running
    if let Some(child) = lock.take() {
        let _ = child.kill();
    }

    // Spawn fresh sidecar instance
    match spawn_python_sidecar(&app) {
        Ok(new_child) => {
            *lock = Some(new_child);
            Ok("Python backend restarted successfully.".to_string())
        }
        Err(err) => Err(format!("Failed to restart sidecar: {}", err)),
    }
}

/// Helper function to spawn the compiled Python backend binary
fn spawn_python_sidecar(app: &AppHandle) -> Result<CommandChild, Box<dyn std::error::Error>> {
    println!("[INFO] 🚀 Spawning Python AI Backend sidecar...");

    let sidecar_command = app.shell().sidecar("neuron-backend")?;
    let (mut rx, child) = sidecar_command.spawn()?;

    // Stream sidecar stdout & stderr in background task
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    let text = String::from_utf8_lossy(&bytes);
                    print!("[Python Sidecar] {}", text);
                }
                CommandEvent::Stderr(bytes) => {
                    let text = String::from_utf8_lossy(&bytes);
                    eprint!("[Python Sidecar ERROR] {}", text);
                }
                CommandEvent::Terminated(payload) => {
                    println!("[Python Sidecar] Terminated with code {:?}", payload.code);
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(child)
}

/// Asynchronous health probe loop
fn start_health_probe() {
    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::new();
        let mut attempts = 0;
        while attempts < 40 {
            tokio::time::sleep(tokio::time::Duration::from_millis(400)).await;
            if let Ok(resp) = client.get("http://127.0.0.1:8000/health").send().await {
                if resp.status().is_success() {
                    println!("\n🟢 [SUCCESS] Neuron Python Sidecar online and healthy at ws://127.0.0.1:8000/ws\n");
                    break;
                }
            }
            attempts += 1;
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let sidecar_state = SidecarState::default();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .manage(sidecar_state.clone())
        .invoke_handler(tauri::generate_handler![
            get_backend_status,
            restart_backend_sidecar
        ])
        .setup(move |app| {
            let app_handle = app.handle().clone();

            // Spawn the Python backend sidecar if compiled binary exists
            match spawn_python_sidecar(&app_handle) {
                Ok(child) => {
                    if let Ok(mut lock) = sidecar_state.0.lock() {
                        *lock = Some(child);
                    }
                    start_health_probe();
                }
                Err(err) => {
                    println!(
                        "[DEV MODE] Sidecar binary not found (running against local backend): {}",
                        err
                    );
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // Guarantee clean sidecar process termination on window close
            if let WindowEvent::Destroyed = event {
                if let Some(state) = window.try_state::<SidecarState>() {
                    if let Ok(mut lock) = state.0.lock() {
                        if let Some(child) = lock.take() {
                            println!("[INFO] 🛑 Window destroyed. Terminating Python sidecar...");
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |_app_handle, event| {
        if let RunEvent::Exit = event {
            println!("[INFO] 🛑 Neuron Application Exiting cleanly.");
        }
    });
}