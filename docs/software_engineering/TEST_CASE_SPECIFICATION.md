# IEEE 829 Master Test Case Specification (TCS)
**Project Title:** Neuron: The Spatial Code Intelligence IDE  
**Document Identifier:** `TCS-NEURON-2.4.0`  
**Standard Compliance:** IEEE Std 829-2008 Standard for Software and System Test Documentation  
**Document Type:** Formal Test Case Specification  
**Classification:** Academic & Industrial Software Verification Suite  
**Total Test Cases:** 47 Test Cases Across 10 Core Architectural Modules  

---

## 1. Document Overview & Test Case Template

Every test case in this specification conforms to the IEEE 829-2008 standard structure:
- **Test Case Identifier:** Unique alphanumeric identifier (`TC-[MODULE]-[INDEX]`).
- **Target Unit Under Test:** Specific source file, class, and method.
- **Traceable Requirement:** Linked Functional Requirement (`FR-xx`) and Use Case (`UC-xx`).
- **Severity / Priority:** Critical, High, Medium, or Low.
- **Pre-conditions:** Initial system state required before execution.
- **Test Inputs / Data:** Explicit parameter values, mock payloads, or code snippets.
- **Execution Steps:** Sequential actions required to run the test.
- **Expected Results:** Measurable, unambiguous output and post-condition state.
- **Pass / Fail Status:** Verification outcome.

---

## 2. Module 1: AST Code Parser & Graph Builder (`backend/core/graph_builder.py`)

### TC-AST-001: Extract Functions, Classes, and Imports from Python Source
- **Module Under Test:** [`backend/core/graph_builder.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/core/graph_builder.py) -> `parse_file_ast()`
- **Traceable Requirement:** `FR-01`, `UC1`
- **Severity / Priority:** Critical / High
- **Pre-conditions:** Python AST parser module initialized. Target file `sample.py` exists on disk.
- **Test Inputs:**
  ```python
  import math
  class GeometryEngine:
      def compute_area(self, radius):
          return math.pi * (radius ** 2)
  def calculate_volume(r, h):
      return GeometryEngine().compute_area(r) * h
  ```
- **Execution Steps:**
  1. Invoke `parse_file_ast("sample.py", source_code)`.
  2. Inspect the returned dictionary of nodes and edges.
  3. Verify presence of class node, method node, function node, and import edge.
- **Expected Results:**
  - Nodes extracted: 3 (`GeometryEngine` [class], `compute_area` [function], `calculate_volume` [function]).
  - Edges extracted: Hierarchy parent-child links (`sample.py -> GeometryEngine -> compute_area`), and dependency call link (`calculate_volume -> compute_area`).
  - Tier assignments: File=1, Class=1, Function=2.
- **Status:** PASS

---

### TC-AST-002: Extract ES6 Classes, Arrow Functions, and Imports from JavaScript/TypeScript
- **Module Under Test:** [`backend/core/graph_builder.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/core/graph_builder.py) -> `parse_js_ts_ast()`
- **Traceable Requirement:** `FR-01`, `UC1`
- **Severity / Priority:** Critical / High
- **Pre-conditions:** Tree-sitter / regex JS grammar tokenizer initialized.
- **Test Inputs:**
  ```javascript
  import { useState } from 'react';
  export const CounterComponent = () => {
    const [count, setCount] = useState(0);
    const increment = () => setCount(count + 1);
    return count;
  };
  ```
- **Execution Steps:**
  1. Call `parse_js_ts_ast("Counter.jsx", js_code)`.
  2. Validate node taxonomy and metadata attributes.
- **Expected Results:**
  - Nodes identified: `CounterComponent` (type: function), `increment` (type: function).
  - External dependencies detected: `react` (`useState`).
  - Lines of Code (LOC) calculated: 6.
- **Status:** PASS

---

### TC-AST-003: Defensive Deduplication of Identical Node Identifiers
- **Module Under Test:** [`backend/core/graph_builder.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/core/graph_builder.py) -> `build_graph()`
- **Traceable Requirement:** `FR-01`, `UC1`
- **Severity / Priority:** High / Medium
- **Pre-conditions:** Multiple source files contain identical helper function names (`init()`).
- **Test Inputs:**
  - File A (`src/core.py`): `def init(): pass`
  - File B (`src/utils.py`): `def init(): pass`
- **Execution Steps:**
  1. Run `build_graph()` across both files.
  2. Inspect the global graph node set.
- **Expected Results:**
  - Two distinct nodes created with scoped fully-qualified identifiers: `src/core.py::init` and `src/utils.py::init`.
  - No key collisions in the graph map; active node count equals 2.
- **Status:** PASS

---

### TC-AST-004: Cyclic Import Detection and Infinite Loop Prevention
- **Module Under Test:** [`backend/core/graph_builder.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/core/graph_builder.py) -> `detect_import_cycles()`
- **Traceable Requirement:** `FR-02`, `UC10`
- **Severity / Priority:** Critical / High
- **Pre-conditions:** Three modules with mutual circular dependencies:
  `ModuleA -> ModuleB -> ModuleC -> ModuleA`.
- **Test Inputs:** Circular graph definition with 3 directed edges.
- **Execution Steps:**
  1. Execute `detect_import_cycles(graph)`.
  2. Verify execution terminates without `RecursionError`.
  3. Validate cycle report payload.
- **Expected Results:**
  - Cycle detected: `['ModuleA', 'ModuleB', 'ModuleC', 'ModuleA']`.
  - Function returns safely within 15 ms.
  - Cycle marked with risk flag in `AppState`.
- **Status:** PASS

---

### TC-AST-005: Boundary Test on Disconnected Single-Node Graph
- **Module Under Test:** [`backend/core/graph_builder.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/core/graph_builder.py) -> `build_graph()`
- **Traceable Requirement:** `FR-01`, `UC1`
- **Severity / Priority:** Medium / Low
- **Pre-conditions:** Repository containing exactly one empty file `empty.py`.
- **Test Inputs:** Zero lines of code, empty string `""`.
- **Execution Steps:**
  1. Call `parse_file_ast("empty.py", "")`.
- **Expected Results:**
  - Returns exactly 1 root file node (`id: "empty.py"`, `tier: 1`, `loc: 0`).
  - Edges list is empty `[]`.
  - Zero unhandled exceptions or NaN coordinate outputs.
- **Status:** PASS

---

### TC-AST-006: High-Scale Stress Parsing (500 Files Benchmark)
- **Module Under Test:** [`backend/core/graph_builder.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/core/graph_builder.py) -> `parse_workspace()`
- **Traceable Requirement:** `FR-01`, `NFR-02`
- **Severity / Priority:** High / Critical
- **Pre-conditions:** Synthetic test repository with 500 Python files and 2,500 total functions generated in memory.
- **Test Inputs:** Directory tree with 500 files.
- **Execution Steps:**
  1. Start high-precision timer `t0 = time.perf_counter()`.
  2. Run `parse_workspace(synthetic_dir)`.
  3. Calculate elapsed time $\Delta t = t_1 - t_0$.
- **Expected Results:**
  - $\Delta t < 1,500 \text{ ms}$ (Target: $NFR-02$).
  - Extracted node count equals $500 \text{ files} + 2,500 \text{ functions} = 3,000 \text{ nodes}$.
  - Memory consumption remains under 250 MB during parse.
- **Status:** PASS

---

## 3. Module 2: JavaScript & Polyglot AST Mutator (`backend/core/js_mutator.py`)

### TC-MUT-001: Lossless Function Rename without Comment Drift
- **Module Under Test:** [`backend/core/js_mutator.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/core/js_mutator.py) -> `rename_function()`
- **Traceable Requirement:** `FR-03`, `UC9`, `NFR-06`
- **Severity / Priority:** Critical / High
- **Pre-conditions:** Source file contains exact indentation, inline comments, and docstrings.
- **Test Inputs:**
  ```python
  # Core calculation routine
  def old_calculate(x: int) -> int:
      """Computes doubled output."""
      # Retain this comment
      return x * 2  # inline note
  ```
- **Execution Steps:**
  1. Call `rename_function(code, "old_calculate", "new_calculate")`.
  2. Perform unified diff comparison between original and transformed code.
- **Expected Results:**
  - Function identifier changed to `new_calculate`.
  - All comments (`# Core calculation routine`, `# Retain this comment`, `# inline note`) preserved character-for-character.
  - Docstring indentation remains unchanged.
- **Status:** PASS

---

### TC-MUT-002: Lossless Parameter Injection with Trailing Commas
- **Module Under Test:** [`backend/core/js_mutator.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/core/js_mutator.py) -> `add_parameter()`
- **Traceable Requirement:** `FR-03`, `UC9`
- **Severity / Priority:** High / Medium
- **Pre-conditions:** Target function `handle_event(event)` exists in CST.
- **Test Inputs:** Add parameter `timeout: float = 5.0`.
- **Execution Steps:**
  1. Execute LibCST mutation visitor.
  2. Parse resulting code with `ast.parse()`.
- **Expected Results:**
  - Resulting signature: `def handle_event(event, timeout: float = 5.0):`.
  - Python parser validates syntax without error.
- **Status:** PASS

---

### TC-MUT-003: Multi-File Cross-Reference Variable Rename
- **Module Under Test:** [`backend/core/js_mutator.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/core/js_mutator.py) -> `batch_rename_symbol()`
- **Traceable Requirement:** `FR-03`, `UC2`, `UC9`
- **Severity / Priority:** Critical / High
- **Pre-conditions:** Symbol `DATABASE_URL` imported and used in 3 distinct files.
- **Test Inputs:** Target symbol: `DATABASE_URL` -> `APP_DATABASE_URI`.
- **Execution Steps:**
  1. Execute `batch_rename_symbol("DATABASE_URL", "APP_DATABASE_URI", workspace)`.
  2. Inspect modified files on disk.
- **Expected Results:**
  - Definition in `config.py` updated.
  - Usages in `db.py` and `service.py` updated.
  - Zero modifications to unrelated variables containing substring `DATABASE`.
- **Status:** PASS

---

### TC-MUT-004: Malformed Syntax Quarantine and Safe Abort
- **Module Under Test:** [`backend/core/js_mutator.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/core/js_mutator.py) -> `apply_mutation()`
- **Traceable Requirement:** `FR-04`, `UC9`
- **Severity / Priority:** Critical / High
- **Pre-conditions:** Input code contains an intentional syntax error (`def unclosed_func(`).
- **Test Inputs:** Syntactically broken source string.
- **Execution Steps:**
  1. Call `apply_mutation(broken_code, mutation_plan)`.
  2. Catch returned response.
- **Expected Results:**
  - Mutation rejected with `CSTParseError` or `SyntaxError`.
  - Original file on disk is untouched (0 bytes written).
  - Detailed line and column error returned to user.
- **Status:** PASS

---

### TC-MUT-005: Boundary Test on Empty Replacement String
- **Module Under Test:** [`backend/core/js_mutator.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/core/js_mutator.py) -> `replace_function_body()`
- **Traceable Requirement:** `FR-03`, `UC9`
- **Severity / Priority:** Medium / Low
- **Pre-conditions:** Target function contains existing statements.
- **Test Inputs:** Replacement body is empty string `""`.
- **Execution Steps:**
  1. Call `replace_function_body(code, "target_func", "")`.
- **Expected Results:**
  - AST mutator inserts `pass` statement to preserve syntactical validity.
  - Code remains valid Python syntax (`def target_func():\n    pass`).
- **Status:** PASS

---

## 4. Module 3: WebSocket Event Router & State Hub (`backend/api/websocket_router.py`)

### TC-WSS-001: Client Handshake and Full Workspace State Emission
- **Module Under Test:** [`backend/api/websocket_router.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/api/websocket_router.py) -> `websocket_endpoint()`
- **Traceable Requirement:** `FR-05`, `UC1`
- **Severity / Priority:** Critical / High
- **Pre-conditions:** FastAPI server running on `ws://127.0.0.1:8000/ws`.
- **Test Inputs:** Client initiates connection handshake.
- **Execution Steps:**
  1. Connect client WebSocket test fixture.
  2. Await initial message frame.
- **Expected Results:**
  - HTTP 101 Switching Protocols handshake confirmed.
  - Initial message type is `WORKSPACE_STATE` containing nodes array, edges array, and git status object.
- **Status:** PASS

---

### TC-WSS-002: Dynamic Node Drag Coordinate Broadcast (`NODE_MOVE`)
- **Module Under Test:** [`backend/api/websocket_router.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/api/websocket_router.py) -> `handle_node_move()`
- **Traceable Requirement:** `FR-05`, `UC1`
- **Severity / Priority:** High / Medium
- **Pre-conditions:** Client connected; node `node-42` exists.
- **Test Inputs:** Payload: `{"event": "NODE_MOVE", "node_id": "node-42", "position": {"x": 128.5, "y": -94.2}}`.
- **Execution Steps:**
  1. Send payload over WebSocket.
  2. Inspect in-memory `AppState`.
- **Expected Results:**
  - `AppState.nodes["node-42"].position.x` updated to `128.5`.
  - `AppState.nodes["node-42"].position.y` updated to `-94.2`.
  - Broadcast reflected to other subscribed peer clients.
- **Status:** PASS

---

### TC-WSS-003: Workspace Reload on External File Creation
- **Module Under Test:** [`backend/api/websocket_router.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/api/websocket_router.py) -> `on_file_created()`
- **Traceable Requirement:** `FR-05`, `UC1`, `UC6`
- **Severity / Priority:** High / Medium
- **Pre-conditions:** Watchdog file observer listening on project root.
- **Test Inputs:** Create file `new_module.py` on disk via OS file system.
- **Execution Steps:**
  1. Trigger disk write.
  2. Monitor WebSocket client message stream.
- **Expected Results:**
  - Server emits event `GRAPH_UPDATE` within 200 ms.
  - New node `new_module.py` present in graph payload.
- **Status:** PASS

---

### TC-WSS-004: Graceful Handling of Sudden Client Disconnect
- **Module Under Test:** [`backend/api/websocket_router.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/api/websocket_router.py) -> `websocket_endpoint()`
- **Traceable Requirement:** `FR-06`, `UC1`
- **Severity / Priority:** High / Medium
- **Pre-conditions:** Active WebSocket connection with ongoing event streams.
- **Test Inputs:** Forceful TCP RST or socket termination without close frame.
- **Execution Steps:**
  1. Abruptly kill client socket.
  2. Check server logs and connection pool manager.
- **Expected Results:**
  - Server intercepts `WebSocketDisconnect` cleanly.
  - Dead connection removed from active subscribers set.
  - Zero unhandled exceptions or thread lockups on server.
- **Status:** PASS

---

### TC-WSS-005: High-Frequency Message Dispatch Benchmark
- **Module Under Test:** [`backend/api/websocket_router.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/api/websocket_router.py) -> `broadcast()`
- **Traceable Requirement:** `FR-05`, `NFR-03`
- **Severity / Priority:** High / High
- **Pre-conditions:** 10 concurrent WebSocket test clients connected.
- **Test Inputs:** 1,000 rapid event packets transmitted sequentially.
- **Execution Steps:**
  1. Measure end-to-end dispatch duration across 1,000 events.
  2. Compute average latency per packet.
- **Expected Results:**
  - Average dispatch latency $< 15 \text{ ms}$ (Target: $NFR-03$).
  - Zero dropped frames or out-of-order sequence errors.
- **Status:** PASS

---

## 5. Module 4: File Service & Workspace Management (`backend/services/file_service.py`)

### TC-FIL-001: Atomic File Save with Temporary Swap Write
- **Module Under Test:** [`backend/services/file_service.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/services/file_service.py) -> `save_file()`
- **Traceable Requirement:** `FR-07`, `UC2`
- **Severity / Priority:** Critical / High
- **Pre-conditions:** File `main.py` contains 100 lines of verified code.
- **Test Inputs:** Updated content string of 105 lines.
- **Execution Steps:**
  1. Call `save_file("main.py", new_content)`.
  2. Verify that write occurs to `main.py.tmp` prior to atomic rename.
- **Expected Results:**
  - `main.py` contains exact 105 lines.
  - No leftover `.tmp` file remains on disk.
  - File modification timestamp updated.
- **Status:** PASS

---

### TC-FIL-002: Pre-Modification Snapshot Creation
- **Module Under Test:** [`backend/services/file_service.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/services/file_service.py) -> `create_snapshot()`
- **Traceable Requirement:** `FR-07`, `UC11`
- **Severity / Priority:** Critical / High
- **Pre-conditions:** File `config.json` exists with content `{"version": 1}`.
- **Test Inputs:** Edit request updating version to `2`.
- **Execution Steps:**
  1. Call `save_file("config.json", new_content, snapshot=True)`.
  2. Check snapshot store `D3` in `.neuron/snapshots/`.
- **Expected Results:**
  - Snapshot file created containing original `{"version": 1}`.
  - Snapshot hash recorded in transaction log.
- **Status:** PASS

---

### TC-FIL-003: 1-Click Rollback from Pre-Modification Snapshot
- **Module Under Test:** [`backend/services/file_service.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/services/file_service.py) -> `rollback_snapshot()`
- **Traceable Requirement:** `FR-07`, `UC5`
- **Severity / Priority:** Critical / High
- **Pre-conditions:** A valid snapshot exists for `config.json`. Current file is modified.
- **Test Inputs:** Rollback transaction identifier.
- **Execution Steps:**
  1. Execute `rollback_snapshot(snapshot_id)`.
  2. Read `config.json` from disk.
- **Expected Results:**
  - File content restored to `{"version": 1}`.
  - WebSocket event `FILE_RESTORED` emitted to frontend.
- **Status:** PASS

---

### TC-FIL-004: Directory Traversal Path Injection Defense (`../` Attack)
- **Module Under Test:** [`backend/services/file_service.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/services/file_service.py) -> `resolve_safe_path()`
- **Traceable Requirement:** `FR-08`, `NFR-05`
- **Severity / Priority:** Critical / Critical
- **Pre-conditions:** Workspace root is `C:\Workspace\Project`.
- **Test Inputs:** Malicious paths:
  1. `../../Windows/System32/cmd.exe`
  2. `..\..\..\etc\passwd`
  3. `subdir/../../../sensitive.env`
- **Execution Steps:**
  1. Call `resolve_safe_path(malicious_path)` for each input.
- **Expected Results:**
  - All attempts throw `PermissionError` or `SecurityViolationException`.
  - Zero access outside the designated workspace root directory.
- **Status:** PASS

---

### TC-FIL-005: Boundary Test on UTF-8 and Unicode File Names
- **Module Under Test:** [`backend/services/file_service.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/services/file_service.py) -> `read_file()`
- **Traceable Requirement:** `FR-08`, `UC1`
- **Severity / Priority:** Medium / Low
- **Pre-conditions:** File created with international characters: `src/données_spatiales_test.py`.
- **Test Inputs:** File path with accented characters and non-ASCII glyphs.
- **Execution Steps:**
  1. Write and read file content using UTF-8 encoding.
- **Expected Results:**
  - Content read matches content written with zero encoding degradation.
- **Status:** PASS

---

## 6. Module 5: Interactive PTY Terminal Multiplexer (`backend/services/terminal_service.py`)

### TC-TRM-001: Spawn ConPTY Pseudo-Terminal on Windows
- **Module Under Test:** [`backend/services/terminal_service.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/services/terminal_service.py) -> `spawn_session()`
- **Traceable Requirement:** `FR-09`, `UC3`
- **Severity / Priority:** High / High
- **Pre-conditions:** Host OS is Windows 10/11. ConPTY subsystem available.
- **Test Inputs:** Shell binary: `powershell.exe`. Dimensions: 80 cols, 24 rows.
- **Execution Steps:**
  1. Call `terminal_service.spawn_session(cols=80, rows=24)`.
  2. Read initial output stream from pseudo-terminal pipe.
- **Expected Results:**
  - Active session handle generated (`terminal_id: uuid4`).
  - Welcome banner and `PS >` prompt received via output buffer.
- **Status:** PASS

---

### TC-TRM-002: Interactive Stdin Command Execution and Stdout Streaming
- **Module Under Test:** [`backend/services/terminal_service.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/services/terminal_service.py) -> `write_stdin()`
- **Traceable Requirement:** `FR-09`, `UC3`
- **Severity / Priority:** High / High
- **Pre-conditions:** Terminal session active.
- **Test Inputs:** Command string: `Write-Output "NEURON_TERMINAL_ONLINE"\r\n`.
- **Execution Steps:**
  1. Call `write_stdin(session_id, input_data)`.
  2. Collect streamed output frames.
- **Expected Results:**
  - Token `NEURON_TERMINAL_ONLINE` captured in stdout stream.
  - ANSI formatting intact.
- **Status:** PASS

---

### TC-TRM-003: Terminal Window Resize Event (`SIGWINCH`)
- **Module Under Test:** [`backend/services/terminal_service.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/services/terminal_service.py) -> `resize_terminal()`
- **Traceable Requirement:** `FR-09`, `UC3`
- **Severity / Priority:** Medium / Low
- **Pre-conditions:** Terminal running with dimensions 80x24.
- **Test Inputs:** New dimensions: 120 columns, 40 rows.
- **Execution Steps:**
  1. Call `resize_terminal(session_id, cols=120, rows=40)`.
- **Expected Results:**
  - ConPTY buffer dimensions successfully resized.
  - Zero buffer overflow or memory corruption.
- **Status:** PASS

---

### TC-TRM-004: Clean Subprocess Termination on Session Close
- **Module Under Test:** [`backend/services/terminal_service.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/services/terminal_service.py) -> `close_session()`
- **Traceable Requirement:** `FR-09`, `UC3`
- **Severity / Priority:** High / High
- **Pre-conditions:** Terminal session executing a long-running command (`python -c "import time; time.sleep(100)"`).
- **Test Inputs:** Terminal close request.
- **Execution Steps:**
  1. Call `close_session(session_id)`.
  2. Inspect OS process table via `psutil`.
- **Expected Results:**
  - Process tree (PowerShell and child Python process) terminated immediately.
  - Zero lingering background zombie processes.
- **Status:** PASS

---

## 7. Module 6: AI Blast Protection & Refactor Guard (`backend/services/ai_service.py`)

### TC-BLS-001: Automatic Execution Under 3-File Mutation Threshold
- **Module Under Test:** [`backend/services/ai_service.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/services/ai_service.py) -> `execute_refactor_plan()`
- **Traceable Requirement:** `FR-10`, `UC8`
- **Severity / Priority:** Critical / High
- **Pre-conditions:** Blast protection setting enabled (`blastProtection: true`).
- **Test Inputs:** Mutation plan touching 2 files (`utils.py`, `models.py`).
- **Execution Steps:**
  1. Submit plan to `execute_refactor_plan()`.
- **Expected Results:**
  - Plan executes autonomously.
  - Pre-mutation snapshots saved for both files.
  - Return status is `SUCCESS`.
- **Status:** PASS

---

### TC-BLS-002: Interception & Modal Block When Mutation Exceeds 3 Files
- **Module Under Test:** [`backend/services/ai_service.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/services/ai_service.py) -> `execute_refactor_plan()`
- **Traceable Requirement:** `FR-10`, `UC5`, `UC8`
- **Severity / Priority:** Critical / High
- **Pre-conditions:** Blast protection setting enabled (`blastProtection: true`).
- **Test Inputs:** Mutation plan touching 5 files (`a.py`, `b.py`, `c.py`, `d.py`, `e.py`).
- **Execution Steps:**
  1. Submit plan to `execute_refactor_plan()`.
- **Expected Results:**
  - Plan blocked from disk execution (0 files modified).
  - Status returned: `AWAITING_USER_APPROVAL`.
  - Frontend prompts user with interactive approval modal showing blast radius diff.
- **Status:** PASS

---

### TC-BLS-003: User Rejection Triggers Complete Transaction Abort
- **Module Under Test:** [`backend/services/ai_service.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/services/ai_service.py) -> `resolve_approval()`
- **Traceable Requirement:** `FR-10`, `UC5`
- **Severity / Priority:** Critical / High
- **Pre-conditions:** Mutation plan paused in `AWAITING_USER_APPROVAL` state.
- **Test Inputs:** User clicks "Reject" in modal (`decision: "REJECT"`).
- **Execution Steps:**
  1. Dispatch rejection decision.
  2. Verify disk state across all 5 files.
- **Expected Results:**
  - Transaction aborted.
  - Zero files modified.
  - In-memory approval queue cleared.
- **Status:** PASS

---

### TC-BLS-004: Save Rate Throttling Prevents Runaway Rapid Edits
- **Module Under Test:** [`backend/services/ai_service.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/services/ai_service.py) -> `validate_rate_limit()`
- **Traceable Requirement:** `FR-11`, `UC12`
- **Severity / Priority:** High / Medium
- **Pre-conditions:** Save rate limiter configured for max 10 edits per second.
- **Test Inputs:** 25 mutation save requests submitted in 100 ms burst.
- **Execution Steps:**
  1. Fire rapid burst of save events.
- **Expected Results:**
  - First 10 requests processed.
  - Requests 11 through 25 throttled or queued with status `RATE_LIMITED`.
  - Prevents IDE crash or file lock exhaustion.
- **Status:** PASS

---

### TC-BLS-005: Blast Radius Dependency Graph Metric Calculation
- **Module Under Test:** [`backend/services/ai_service.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/services/ai_service.py) -> `calculate_blast_radius()`
- **Traceable Requirement:** `FR-10`, `UC8`
- **Severity / Priority:** High / Medium
- **Pre-conditions:** Graph with `core.py` imported by 12 downstream modules.
- **Test Inputs:** Target mutation node: `core.py`.
- **Execution Steps:**
  1. Call `calculate_blast_radius("core.py")`.
- **Expected Results:**
  - Impact metric correctly reports 12 affected downstream nodes.
  - Visual highlight rays calculated for frontend canvas display.
- **Status:** PASS

---

## 8. Module 7: PixiJS WebGPU Celestial Spatial Canvas (`frontend/src/components/canvas/PixiSpatialEngine.jsx`)

### TC-CAN-001: 4-Level LOD Semantic Zoom Filtering
- **Module Under Test:** [`frontend/src/components/canvas/PixiSpatialEngine.jsx`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/components/canvas/PixiSpatialEngine.jsx)
- **Traceable Requirement:** `FR-12`, `UC1`
- **Severity / Priority:** High / High
- **Pre-conditions:** PixiJS application mounted with graph data loaded.
- **Test Inputs:** Set camera zoom sequentially to: `0.50`, `0.15`, `0.05`, `0.005`.
- **Execution Steps:**
  1. Set zoom = 0.50 (LOD 1) -> Verify functions visible.
  2. Set zoom = 0.15 (LOD 2) -> Verify file planets active, functions aggregated.
  3. Set zoom = 0.05 (LOD 3) -> Verify folder suns active, files culled.
  4. Set zoom = 0.005 (LOD 4) -> Verify cosmic clusters active, labels hidden.
- **Expected Results:**
  - Text visibility and sprite alpha match configured LOD zoom thresholds (`0.35`, `0.07`, `0.03`, `0.001`).
- **Status:** PASS

---

### TC-CAN-002: GPU Frustum Culling on Out-of-Viewport Nodes
- **Module Under Test:** [`frontend/src/components/canvas/PixiSpatialEngine.jsx`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/components/canvas/PixiSpatialEngine.jsx)
- **Traceable Requirement:** `FR-12`, `NFR-01`, `NFR-04`
- **Severity / Priority:** High / High
- **Pre-conditions:** 3,000 nodes loaded. Viewport displays a 400x400 area containing 50 nodes.
- **Test Inputs:** Viewport bounding box `(x: [0, 400], y: [0, 400])`.
- **Execution Steps:**
  1. Execute rendering pass.
  2. Inspect count of visible sprites sent to WebGPU draw calls.
- **Expected Results:**
  - Only ~50 visible nodes rendered.
  - The remaining 2,950 nodes culled (`sprite.visible = false`).
  - GPU draw calls reduced by > 90%.
- **Status:** PASS

---

### TC-CAN-003: 60 FPS Render Performance Benchmark Under Full Graph Load
- **Module Under Test:** [`frontend/src/components/canvas/PixiSpatialEngine.jsx`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/components/canvas/PixiSpatialEngine.jsx)
- **Traceable Requirement:** `FR-12`, `NFR-01`
- **Severity / Priority:** Critical / High
- **Pre-conditions:** Canvas populated with 2,000 active celestial bodies and 3,500 edges.
- **Test Inputs:** Continuous diagonal camera pan for 10 seconds.
- **Execution Steps:**
  1. Track frame delta times using `performance.now()`.
  2. Compute average Frames Per Second (FPS) and 1% low frame time.
- **Expected Results:**
  - Average FPS $\ge 58.0$.
  - Maximum frame time $< 16.6 \text{ ms}$.
  - Zero visual tearing or jitter.
- **Status:** PASS

---

### TC-CAN-004: Zoom-Based Connecting Line Stroke Scaling
- **Module Under Test:** [`frontend/src/components/canvas/PixiSpatialEngine.jsx`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/components/canvas/PixiSpatialEngine.jsx)
- **Traceable Requirement:** `FR-13`, `UC1`
- **Severity / Priority:** High / Medium
- **Pre-conditions:** `spatialLineScale = 2.5`. Camera zoomed out to $Z = 0.05$.
- **Test Inputs:** Line types: `hierarchy`, `call`, `network_bridge`.
- **Execution Steps:**
  1. Measure rendered stroke width across zoom depths ($Z = 1.0 \to Z = 0.05$).
- **Expected Results:**
  - Lines remain sharp, clear, and visible at deep zoom without disappearing or expanding into obscuring blocks.
  - Quadratic scaling artifact eliminated.
- **Status:** PASS

---

### TC-CAN-005: Hierarchical Effective Mass Line Expansion
- **Module Under Test:** [`frontend/src/components/canvas/PixiSpatialEngine.jsx`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/components/canvas/PixiSpatialEngine.jsx) -> `getEffectiveMass()`
- **Traceable Requirement:** `FR-13`, `UC1`
- **Severity / Priority:** Medium / Low
- **Pre-conditions:** Child nodes merged into parent folder sun with accumulated mass $= 25$.
- **Test Inputs:** Render conduit connecting merged parent sun.
- **Execution Steps:**
  1. Verify line thickness computation.
- **Expected Results:**
  - Line stroke scales proportionally with absorbed child mass, visually indicating connection density.
- **Status:** PASS

---

### TC-CAN-006: Laser Photon Energy Packet Animation on Network Bridges
- **Module Under Test:** [`frontend/src/components/canvas/PixiSpatialEngine.jsx`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/components/canvas/PixiSpatialEngine.jsx)
- **Traceable Requirement:** `FR-13`, `UC1`
- **Severity / Priority:** Low / Low
- **Pre-conditions:** `spatialParticles: true`. Network bridge between frontend and backend.
- **Test Inputs:** Active bridge edge with data transmission.
- **Execution Steps:**
  1. Inspect photon particle coordinates over consecutive ticks.
- **Expected Results:**
  - Photons travel smoothly along the bezier curve from source to target.
  - Photons recycle cleanly when reaching target node.
- **Status:** PASS

---

## 9. Module 8: D3 Force Simulation Physics Engine (`frontend/src/hooks/usePhysicsEngine.js`)

### TC-PHY-001: Verification of 24 Configurable Physics Parameters
- **Module Under Test:** [`frontend/src/hooks/usePhysicsEngine.js`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/hooks/usePhysicsEngine.js)
- **Traceable Requirement:** `FR-14`, `UC1`
- **Severity / Priority:** Critical / High
- **Pre-conditions:** Engine initialized with settings object.
- **Test Inputs:** Verify that all 24 parameters are resolved from `settings` without hardcoded fallbacks:
  `physicsGravity`, `physicsRepulsionFolder`, `physicsRepulsionFile`, `physicsRepulsionFunction`,
  `physicsMaxRepulsionDistance`, `physicsSpringMoonDistance`, `physicsSpringPlanetDistance`,
  `physicsSpringNeuralDistance`, `physicsSpringBridgeDistance`, `physicsSpringHierarchyStrength`,
  `physicsSpringCallStrength`, `physicsSpringBridgeStrength`, `physicsCollisionFolder`,
  `physicsCollisionFile`, `physicsCollisionFunction`, `physicsCollisionPadding`,
  `physicsCollisionIterations`, `physicsAlphaDecay`, `physicsVelocityDecay`,
  `physicsRestingAlpha`, `physicsDraggingAlpha`, `physicsSpawnFileSpeed`,
  `physicsSpawnFuncSpeed`, `spatialMergeRepulsion`.
- **Execution Steps:**
  1. Inspect simulation forces configuration.
- **Expected Results:**
  - All 24 values match the injected settings object.
  - Zero hardcoded constant overrides.
- **Status:** PASS

---

### TC-PHY-002: Live Dynamic Reheating on Settings Slider Adjustment
- **Module Under Test:** [`frontend/src/hooks/usePhysicsEngine.js`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/hooks/usePhysicsEngine.js)
- **Traceable Requirement:** `FR-15`, `UC1`
- **Severity / Priority:** High / High
- **Pre-conditions:** Simulation running at resting alpha ($0.018$).
- **Test Inputs:** Change `physicsRepulsionFolder` from `-1800` to `-3000`.
- **Execution Steps:**
  1. Update setting via `updateSetting('physicsRepulsionFolder', -3000)`.
  2. Monitor simulation alpha level.
- **Expected Results:**
  - `chargeForce` dynamically updates its strength.
  - Simulation reheats to $\ge 0.18$ and gently settles into new positions.
  - Canvas does NOT reload or re-mount.
- **Status:** PASS

---

### TC-PHY-003: Perpetual Cosmic Float Resting Alpha Stability
- **Module Under Test:** [`frontend/src/hooks/usePhysicsEngine.js`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/hooks/usePhysicsEngine.js)
- **Traceable Requirement:** `FR-14`, `UC1`
- **Severity / Priority:** High / Medium
- **Pre-conditions:** IDE idle for 60 seconds with no user interaction.
- **Test Inputs:** Check `simulation.alpha()`.
- **Execution Steps:**
  1. Measure simulation alpha over 60 seconds.
- **Expected Results:**
  - Alpha stabilizes at `RESTING_ALPHA_TARGET` ($0.018$).
  - Simulation does not freeze dead ($0.0$), maintaining a gentle, organic floating motion.
- **Status:** PASS

---

### TC-PHY-004: Zero-Latency Node Dragging Responsiveness
- **Module Under Test:** [`frontend/src/hooks/usePhysicsEngine.js`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/hooks/usePhysicsEngine.js) -> `onDragStart()`, `onDragMove()`
- **Traceable Requirement:** `FR-14`, `UC1`
- **Severity / Priority:** High / High
- **Pre-conditions:** Pointer down on node `node-7`.
- **Test Inputs:** Drag coordinates $(x: 250, y: 300)$.
- **Execution Steps:**
  1. Call `onDragStart("node-7", 250, 300)`.
  2. Call `onDragMove("node-7", 260, 310)`.
- **Expected Results:**
  - Target node coordinates lock to cursor position via `fx`, `fy`.
  - Simulation alpha elevates immediately to `DRAGGING_ALPHA_TARGET` ($0.25$) for instant elastic response.
  - Releasing pointer resets `fx`, `fy` to `null` and restores resting alpha ($0.018$).
- **Status:** PASS

---

### TC-PHY-005: Boundary Test on Centering Gravity Force ($Gravity = 0.0$)
- **Module Under Test:** [`frontend/src/hooks/usePhysicsEngine.js`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/hooks/usePhysicsEngine.js)
- **Traceable Requirement:** `FR-14`, `UC1`
- **Severity / Priority:** Medium / Low
- **Pre-conditions:** Set `physicsGravity: 0.0`.
- **Test Inputs:** Gravitational pull disabled.
- **Execution Steps:**
  1. Execute 100 simulation ticks.
- **Expected Results:**
  - Nodes expand outwards naturally without center-seeking force.
  - Zero NaN coordinate calculations or floating point errors.
- **Status:** PASS

---

### TC-PHY-006: Collision Detection and Overlap Prevention
- **Module Under Test:** [`frontend/src/hooks/usePhysicsEngine.js`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/hooks/usePhysicsEngine.js) -> `collideForce`
- **Traceable Requirement:** `FR-14`, `UC1`
- **Severity / Priority:** High / High
- **Pre-conditions:** Two file nodes placed at identical coordinates $(x: 0, y: 0)$.
- **Test Inputs:** Simulation tick execution.
- **Execution Steps:**
  1. Measure distance between nodes after 10 ticks.
- **Expected Results:**
  - `forceCollide` resolves overlap.
  - Distance between node centers $\ge (22 + 22 + 10) = 54 \text{ px}$.
- **Status:** PASS

---

### TC-PHY-007: Background Tab Hibernation and CPU Throttling
- **Module Under Test:** [`frontend/src/hooks/usePhysicsEngine.js`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/hooks/usePhysicsEngine.js) -> `handleVisibilityChange()`
- **Traceable Requirement:** `FR-14`, `NFR-04`
- **Severity / Priority:** High / High
- **Pre-conditions:** Browser tab minimized or hidden (`document.hidden = true`).
- **Test Inputs:** Visibility state change event.
- **Execution Steps:**
  1. Trigger visibility change to `hidden`.
  2. Inspect CPU usage of simulation worker.
- **Expected Results:**
  - `simulation.stop()` invoked immediately.
  - CPU usage drops to 0.0%.
  - Restoring focus restarts simulation at resting alpha ($0.018$).
- **Status:** PASS

---

### TC-PHY-008: Reset to Defaults Setting Restoration
- **Module Under Test:** [`frontend/src/components/layout/SettingsModal.jsx`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/components/layout/SettingsModal.jsx)
- **Traceable Requirement:** `FR-14`, `UC1`
- **Severity / Priority:** High / Medium
- **Pre-conditions:** User modified 10 physics sliders to arbitrary values.
- **Test Inputs:** User clicks "Reset to Defaults" button on Physics tab.
- **Execution Steps:**
  1. Trigger `handleResetCurrentTabDefaults()`.
- **Expected Results:**
  - All 24 physics variables revert to exact factory defaults (`physicsGravity = 0.008`, `physicsRepulsionFolder = -1800`, etc.).
  - UI sliders update to reflect restored defaults.
- **Status:** PASS

---

## 10. Module 9: Multi-Key AI Provider & Settings Engine (`frontend/src/hooks/useSettings.js`)

### TC-AIP-001: Automatic Migration of Local Storage Settings
- **Module Under Test:** [`frontend/src/hooks/useSettings.js`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/hooks/useSettings.js)
- **Traceable Requirement:** `FR-16`, `UC4`
- **Severity / Priority:** High / Medium
- **Pre-conditions:** Existing user local storage holds legacy settings object without physics keys.
- **Test Inputs:** Legacy local storage state loaded on boot.
- **Execution Steps:**
  1. Initialize `useSettings()`.
- **Expected Results:**
  - Missing physics keys populated automatically from `defaultSettings`.
  - User's existing custom settings preserved without overwrite.
- **Status:** PASS

---

### TC-AIP-002: Dynamic AI Key Provider Auto-Discovery
- **Module Under Test:** [`frontend/src/components/layout/SettingsModal.jsx`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/components/layout/SettingsModal.jsx)
- **Traceable Requirement:** `FR-16`, `UC4`
- **Severity / Priority:** High / High
- **Pre-conditions:** User inputs API key.
- **Test Inputs:** Key prefixed with `sk-ant-` (Anthropic pattern) or `AIzaSy` (Google Gemini pattern).
- **Execution Steps:**
  1. Paste key into API key modal input.
- **Expected Results:**
  - Provider auto-detected as Anthropic or Google Gemini.
  - Corresponding models populated in model selector.
- **Status:** PASS

---

### TC-AIP-003: API Key Masking and Plaintext Storage Prevention
- **Module Under Test:** [`frontend/src/components/layout/SettingsModal.jsx`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/components/layout/SettingsModal.jsx)
- **Traceable Requirement:** `FR-16`, `NFR-05`
- **Severity / Priority:** High / High
- **Pre-conditions:** User added active API key.
- **Test Inputs:** Inspect DOM rendering in Settings window.
- **Execution Steps:**
  1. Inspect `<input>` element for key.
- **Expected Results:**
  - Input field renders with `type="password"`.
  - Values obscured with bullet characters unless explicitly toggled by user.
- **Status:** PASS

---

### TC-AIP-004: Fallback to Local Ollama When Cloud Key Absent
- **Module Under Test:** [`frontend/src/hooks/useSettings.js`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/hooks/useSettings.js)
- **Traceable Requirement:** `FR-16`, `UC4`
- **Severity / Priority:** High / Medium
- **Pre-conditions:** No cloud API keys registered in settings.
- **Test Inputs:** Trigger AI code explanation request.
- **Execution Steps:**
  1. Inspect outgoing inference target.
- **Expected Results:**
  - Active provider defaults to `local-ollama` on `http://127.0.0.1:11434`.
  - Application functions completely offline without requiring cloud keys.
- **Status:** PASS

---

## 11. Module 10: Modular Workspace & Tab State Manager (`frontend/src/components/layout/modular/ModularWorkspace.jsx`)

### TC-MOD-001: Tab Memory Retention Across Tab Switches (0 ms Reload Delay)
- **Module Under Test:** [`frontend/src/components/layout/modular/ModularWorkspace.jsx`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/components/layout/modular/ModularWorkspace.jsx)
- **Traceable Requirement:** `FR-17`, `UC2`
- **Severity / Priority:** Critical / High
- **Pre-conditions:** Tab A (`main.py`) and Tab B (`app.jsx`) opened in editor. Tab A has dirty unsaved edits.
- **Test Inputs:** Switch from Tab A to Tab B, then switch back to Tab A.
- **Execution Steps:**
  1. Switch to Tab B.
  2. Switch back to Tab A.
  3. Inspect editor content and cursor position.
- **Expected Results:**
  - Tab A displays instantly with 0 ms reload delay.
  - Unsaved text edits and cursor line position preserved completely.
  - No background re-fetch from disk.
- **Status:** PASS

---

### TC-MOD-002: Persistent Image and SVG Viewer Cache
- **Module Under Test:** [`frontend/src/components/layout/modular/ModularWorkspace.jsx`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/components/layout/modular/ModularWorkspace.jsx)
- **Traceable Requirement:** `FR-17`, `UC2`
- **Severity / Priority:** Medium / Medium
- **Pre-conditions:** SVG asset tab (`logo.svg`) opened alongside code files.
- **Test Inputs:** Switch between code file and SVG image tab 20 times.
- **Execution Steps:**
  1. Rapidly switch tabs.
  2. Monitor image loading state.
- **Expected Results:**
  - Image does not show loading spinners or reload flickers.
  - Asset stays cached in component memory.
- **Status:** PASS

---

### TC-MOD-003: Ghost Tab Elimination Across Workspace Switches
- **Module Under Test:** [`frontend/src/components/layout/modular/ModularWorkspace.jsx`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/components/layout/modular/ModularWorkspace.jsx)
- **Traceable Requirement:** `FR-18`, `UC1`, `UC2`
- **Severity / Priority:** High / High
- **Pre-conditions:** Workspace 1 loaded with open tabs (`w1_file.py`).
- **Test Inputs:** User opens Workspace 2 (`C:\Workspace2`).
- **Execution Steps:**
  1. Switch workspace folder.
  2. Inspect active editor tabs in top bar.
- **Expected Results:**
  - Tabs from Workspace 1 are closed cleanly.
  - No "ghost tabs" or stale missing file errors displayed.
- **Status:** PASS

---

### TC-MOD-004: Editor Panel Resizing and 5x AI Panel Width Expansion
- **Module Under Test:** [`frontend/src/components/layout/modular/ModularWorkspace.jsx`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/components/layout/modular/ModularWorkspace.jsx)
- **Traceable Requirement:** `FR-18`, `UC2`
- **Severity / Priority:** Medium / Low
- **Pre-conditions:** Default layout rendered.
- **Test Inputs:** Inspect right-side AI assistant panel dimensions.
- **Execution Steps:**
  1. Measure panel minSize and defaultSize.
- **Expected Results:**
  - Left explorer sidebar preserves default width.
  - Right AI panel default size set to wide view (275 px / 38% ratio), providing spacious readability for code diffs.
- **Status:** PASS
