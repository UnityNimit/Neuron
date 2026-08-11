// src/services/pyodideService.js

export const loadPyodideEngine = async (onStdout, onStderr) => {
  return new Promise((resolve, reject) => {
    try {
      console.log("Downloading WebAssembly Python Engine...");
      const script = document.createElement('script');
      script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js";
      script.async = true;
      document.body.appendChild(script);

      script.onload = async () => {
        const pyodide = await window.loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/",
          stdout: onStdout,
          stderr: onStderr
        });
        console.log("✅ Pyodide is locked and loaded!");
        resolve(pyodide);
      };
    } catch (err) {
      console.error("Pyodide failed to load:", err);
      reject(err);
    }
  });
};