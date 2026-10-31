# IEEE 829 Master Test Plan (MTP)
**Project Title:** Neuron: The Spatial Code Intelligence IDE  
**Document Identifier:** `MTP-NEURON-2.4.0-REV3`  
**Standard Compliance:** IEEE 829-2008 Standard for Software and System Test Documentation  
**Author:** Quality Assurance & Software Engineering Group  
**Target Release:** Version 1.2.0 / Academic Milestone Semester 5  
**Document Status:** Approved for Baselined Execution  

---

## 1. Test Plan Identifier & Version History

### 1.1 Document Identifier
`MTP-NEURON-2.4.0-REV3`

### 1.2 Revision History
| Revision | Date | Author | Description of Changes | Approved By |
| :--- | :--- | :--- | :--- | :--- |
| `v1.0.0` | 2026-08-20 | QA Engineer | Initial draft of the Unit & System Test Plan. | Lead Architect |
| `v2.0.0` | 2026-10-02 | QA Group | Incorporated WebSocket state sync and AST mutator suites. | Project Supervisor |
| `v2.4.0` | 2026-10-27 | QA Group | Integrated WebGPU Pixi celestial engine and 24-parameter D3 physics test suites. | Faculty Reviewer |

---

## 2. References & Standards

The formulation of this test plan adheres strictly to the following engineering standards:
1. **IEEE Std 829-2008:** Standard for Software and System Test Documentation.
2. **IEEE Std 730-2014:** Standard for Software Quality Assurance Processes.
3. **IEEE Std 1012-2012:** Standard for System and Software Verification and Validation.
4. **ISO/IEC/IEEE 29119-3:2013:** Software Testing — Test Documentation.
5. **Neuron System Design Specification:** [`system_design_specification.md`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/docs/software_engineering/system_design_specification.md).

---

## 3. Introduction & Objectives

### 3.1 System Context
Neuron is a desktop Spatial Integrated Development Environment (IDE) that replaces traditional linear file trees with an interactive 3D/2.5D celestial node-graph. The application couples a Rust-based native Tauri desktop shell with a React/PixiJS frontend canvas and a dedicated local Python 3.11 backend service.

### 3.2 Testing Mission & Objectives
The primary mission of the testing program is to guarantee architectural robustness, memory safety, data integrity, and real-time responsiveness. Specific objectives include:
1. **Zero Data Corruption:** Verify that all AST mutations and file writes are atomic, reversible, and lossless.
2. **Deterministic State Synchronization:** Confirm that the In-Memory Graph (`AppState`) and frontend canvas stay strictly synchronized over WebSocket channels.
3. **Execution Guardrails:** Validate that autonomous AI refactoring operations respect strict blast radius constraints and save rate limits.
4. **High-Performance Physics & Rendering:** Ensure that celestial layout computations and WebGPU canvas rendering maintain a consistent 60 FPS under graph loads of 5,000+ nodes.

---

## 4. Software Test Items (Items Under Test)

The scope of items under test encompasses the complete system architecture:

| Item Identifier | Subsystem / Module | Source File Reference | Language / Technology |
| :--- | :--- | :--- | :--- |
| `SUT-MOD-01` | AST Code Parser & Graph Builder | [`backend/core/graph_builder.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/core/graph_builder.py) | Python 3.11, AST, Tree-Sitter |
| `SUT-MOD-02` | Lossless AST Mutator & Refactorer | [`backend/core/js_mutator.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/core/js_mutator.py) | Python 3.11, LibCST |
| `SUT-MOD-03` | WebSocket Event Router & State Hub | [`backend/api/websocket_router.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/api/websocket_router.py) | FastAPI, WebSockets |
| `SUT-MOD-04` | File Service & Workspace Management | [`backend/services/file_service.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/services/file_service.py) | Python 3.11, Watchdog |
| `SUT-MOD-05` | Interactive PTY Terminal Multiplexer | [`backend/services/terminal_service.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/services/terminal_service.py) | Python 3.11, ConPTY, pywinpty |
| `SUT-MOD-06` | AI Blast Protection & Refactor Guard | [`backend/services/ai_service.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/backend/services/ai_service.py) | Python 3.11, Pydantic |
| `SUT-MOD-07` | PixiJS WebGPU Celestial Canvas Engine | [`frontend/src/components/canvas/PixiSpatialEngine.jsx`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/components/canvas/PixiSpatialEngine.jsx) | JavaScript / React, PixiJS v8 |
| `SUT-MOD-08` | D3 Force Simulation Physics Engine | [`frontend/src/hooks/usePhysicsEngine.js`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/hooks/usePhysicsEngine.js) | JavaScript, D3-Force |
| `SUT-MOD-09` | Multi-Key AI Provider & Settings Engine | [`frontend/src/hooks/useSettings.js`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/hooks/useSettings.js) | JavaScript / React Hooks |
| `SUT-MOD-10` | Modular Workspace & Tab State Manager | [`frontend/src/components/layout/modular/ModularWorkspace.jsx`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src/components/layout/modular/ModularWorkspace.jsx) | JavaScript / React, Panels |

---

## 5. Software Risk Analysis & Mitigation

| Risk ID | Identified Risk Description | Probability | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| `RSK-01` | **Concurrency Race Conditions on File Writes:** Simultaneous edits from user Monaco editor and AI agent causing file tearing. | Medium | High | Atomic file writes via temporary swap files (`.tmp`) with file-lock mutex and version checks. |
| `RSK-02` | **Circular Dependency Loop in AST Parser:** Malformed circular imports triggering infinite recursion during graph generation. | High | Critical | Breadth-First Search (BFS) / Depth-First Search (DFS) cycle-detection using visited set hash tables. |
| `RSK-03` | **Subprocess Process Leaks on Windows:** Unclosed ConPTY or terminal worker tasks lingering as zombie processes. | Medium | High | Process tree termination (`taskkill /F /T`) integrated into application shutdown hooks (`hooks.nsh`). |
| `RSK-04` | **WebGPU Canvas Memory Leaks:** Failure to release Pixi textures and geometry buffers across workspace reload cycles. | Medium | High | Explicit sprite and texture destroy calls (`texture.destroy(true)`) during container unmount cycles. |
| `RSK-05` | **Uncontrolled AI Mutation Bursts:** Malicious or runaway LLM hallucinations rewriting entire repositories without consent. | Low | Critical | Autonomous AI Blast Shield enforcing a 3-file mutation limit and 1-click snapshot rollback (`D3`). |

---

## 6. Testing Strategy & Methodology

### 6.1 Levels of Testing
```
       +---------------------------------------------+
       |         ACCEPTANCE / USABILITY TESTING      |
       +---------------------------------------------+
       |           SYSTEM / INTEGRATION TESTING      |
       +---------------------------------------------+
       |             MODULE / UNIT TESTING           |
       +---------------------------------------------+
```

1. **Unit Testing (Level 1):** Focuses on isolated functional routines (e.g., AST parsing, coordinate sanitization, string tokenization, mathematical force calculations).
2. **Integration Testing (Level 2):** Tests interfaces between interacting modules (e.g., File Watcher emitting events to WebSocket Router, AST Graph Builder piping nodes to Pixi Canvas).
3. **System Testing (Level 3):** Validates end-to-end user workflows (e.g., opening a repository, performing an AI-assisted refactoring, verifying visual git history).
4. **Performance & Stress Testing (Level 4):** Measures frame rates, WebSocket latency, large-repository parsing limits, and memory footprint under heavy loads.
5. **Security & Boundary Testing (Level 5):** Evaluates path traversal attacks (`../`), shell command injection, and invalid configuration parameters.

### 6.2 Test Design Techniques
- **Equivalence Partitioning (EP):** Partitioning input ranges into valid and invalid classes.
- **Boundary Value Analysis (BVA):** Testing boundary extremities (`min-1`, `min`, `nominal`, `max`, `max+1`).
- **State Transition Testing:** Validating system state transitions (Idle -> Spawning -> Running -> Hibernating -> Terminated).
- **Basis Path Testing:** Determining Cyclomatic Complexity ($V(G) = E - N + 2P$) to ensure 100% independent path coverage.

---

## 7. Item Pass / Fail Criteria

### 7.1 Entry Criteria
1. Backend environment compiles with zero fatal import errors under Python 3.11.
2. Frontend production build passes Vite compilation with zero syntax or bundling errors.
3. Test environment configurations and mock test fixtures are initialized.

### 7.2 Exit Criteria
1. **100% Execution Rate:** All planned test cases executed without omission.
2. **100% Pass Rate for Critical and High Severity Cases:** Zero unresolved blocker or critical severity defects.
3. **Pass Rate >= 98% for Medium/Low Severity Cases:** Minor cosmetic discrepancies documented and deferred to future sprints.
4. **Performance Threshold Compliance:**
   - Spatial graph parsing time < 1,500 ms for 500 files.
   - Panning and zooming canvas rendering sustained at >= 58 FPS.
   - WebSocket message dispatch latency < 15 ms.

---

## 8. Environmental Needs & Test Rig

### 8.1 Hardware Configuration
- **Processor:** AMD Ryzen or Intel Core i7 / i9 (8 cores, 16 threads).
- **System Memory:** 16 GB DDR4/DDR5 RAM minimum.
- **Graphics Accelerator:** Dedicated or integrated GPU supporting WebGL 2.0 / WebGPU.
- **Storage:** NVMe Solid State Drive (SSD) with >= 10 GB free space.

### 8.2 Software Configuration
- **Host Operating System:** Microsoft Windows 10 / 11 (64-bit).
- **Runtime Engines:** Python 3.11.x, Node.js v20.x, Rust 1.80+ (MSVC toolchain).
- **Test Frameworks:** `pytest` (v8.x), `pytest-asyncio`, `unittest`, `vite`.
- **Target Desktop Binary:** [`neuron.exe`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/frontend/src-tauri/target/release/neuron.exe).

---

## 9. Test Deliverables

In accordance with IEEE 829 Clause 4, the following documentation deliverables are generated:
1. **Master Test Plan:** [`IEEE_829_TEST_PLAN.md`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/docs/software_engineering/IEEE_829_TEST_PLAN.md)
2. **Requirements Traceability Matrix:** [`REQUIREMENTS_TRACEABILITY_MATRIX.md`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/docs/software_engineering/REQUIREMENTS_TRACEABILITY_MATRIX.md)
3. **Test Design Specification:** [`TEST_DESIGN_SPECIFICATION.md`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/docs/software_engineering/TEST_DESIGN_SPECIFICATION.md)
4. **Master Test Case Specification:** [`TEST_CASE_SPECIFICATION.md`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/docs/software_engineering/TEST_CASE_SPECIFICATION.md)
5. **Test Procedures & Execution Log:** [`TEST_PROCEDURES_AND_EXECUTION_LOG.md`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/docs/software_engineering/TEST_PROCEDURES_AND_EXECUTION_LOG.md)
6. **Defect & Anomaly Report:** [`DEFECT_AND_ANOMALY_REPORT.md`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/docs/software_engineering/DEFECT_AND_ANOMALY_REPORT.md)
7. **Test Summary Report:** [`TEST_SUMMARY_REPORT.md`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/docs/software_engineering/TEST_SUMMARY_REPORT.md)
8. **Automated Test Suite:** [`tests/test_software_engineering_suite.py`](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/tests/test_software_engineering_suite.py)

---

## 10. Approval & Sign-Off

| Stakeholder Role | Representative Name | Approval Signature | Date |
| :--- | :--- | :--- | :--- |
| **Lead Quality Assurance Engineer** | QA Engineering Directorate | APPROVED | 2026-10-27 |
| **Chief Software Architect** | Architecture Review Board | APPROVED | 2026-10-27 |
| **Academic Faculty Supervisor** | Course Evaluation Committee | APPROVED | 2026-10-27 |
