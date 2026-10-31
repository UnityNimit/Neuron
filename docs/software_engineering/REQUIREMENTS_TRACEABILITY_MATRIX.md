# Requirements Traceability Matrix (RTM)
**Project Title:** Neuron: The Spatial Code Intelligence IDE  
**Document Identifier:** `RTM-NEURON-2.4.0`  
**Standard Compliance:** IEEE Std 829-2008 & IEEE Std 1012-2012  
**Traceability Scope:** Bidirectional (Requirements <-> Use Cases <-> Test Cases)  
**Status:** 100% Coverage Verified  

---

## 1. Traceability Purpose & Methodology

The Requirements Traceability Matrix (RTM) provides bidirectional verification tracing every user need and formal requirement established in the [System Design Specification](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/docs/software_engineering/system_design_specification.md) through to its executing test verification cases in the [Master Test Case Specification](file:///c:/Users/unity/OneDrive/Desktop/sem%205/Neuron/docs/software_engineering/TEST_CASE_SPECIFICATION.md).

### 1.1 Verification Method Codes
- **[T] Test:** Empirical execution under automated test harness or manual test procedure.
- **[D] Demonstration:** Observable operational verification in the running user interface.
- **[A] Analysis:** Algorithmic verification, benchmark profiling, or mathematical proof.
- **[I] Inspection:** Static code review, AST structural verification, or configuration audit.

---

## 2. Functional Requirements Traceability Matrix

| Req ID | Requirement Description | Linked Use Case | Verification Method | Associated Test Case IDs | Test Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FR-01** | Multi-language AST parsing and graph node extraction (`.py`, `.js`, `.ts`) | UC1, UC9 | **[T]** | `TC-AST-001`, `TC-AST-002`, `TC-AST-003`, `TC-AST-006` | PASS |
| **FR-02** | Cyclic dependency detection and topological sorting in code graph | UC10 | **[T], [A]** | `TC-AST-004`, `TC-AST-005` | PASS |
| **FR-03** | Lossless AST code refactoring and syntax tree preservation | UC2, UC9 | **[T], [I]** | `TC-MUT-001`, `TC-MUT-002`, `TC-MUT-003`, `TC-MUT-005` | PASS |
| **FR-04** | AST invalid syntax quarantine and error recovery handling | UC9 | **[T]** | `TC-MUT-004` | PASS |
| **FR-05** | Real-time bidirectional WebSocket event routing and state synchronization | UC1, UC2, UC6 | **[T], [D]** | `TC-WSS-001`, `TC-WSS-002`, `TC-WSS-003`, `TC-WSS-005` | PASS |
| **FR-06** | WebSocket connection heartbeat, reconnection, and graceful degradation | UC1 | **[T]** | `TC-WSS-004` | PASS |
| **FR-07** | Atomic file save operations with pre-modification snapshot backup | UC2, UC5, UC11 | **[T]** | `TC-FIL-001`, `TC-FIL-002`, `TC-FIL-003` | PASS |
| **FR-08** | File tree traversal with path traversal security isolation (`../` defense) | UC1 | **[T]** | `TC-FIL-004`, `TC-FIL-005` | PASS |
| **FR-09** | ConPTY interactive pseudo-terminal multiplexing and ANSI streaming | UC3 | **[T], [D]** | `TC-TRM-001`, `TC-TRM-002`, `TC-TRM-003`, `TC-TRM-004` | PASS |
| **FR-10** | AI Blast Protection: 3-file mutation limit and 1-click snapshot rollback | UC4, UC5, UC8 | **[T]** | `TC-BLS-001`, `TC-BLS-002`, `TC-BLS-003`, `TC-BLS-005` | PASS |
| **FR-11** | File edit burst throttling to prevent runaway agent mutations | UC8, UC12 | **[T]** | `TC-BLS-004` | PASS |
| **FR-12** | PixiJS WebGPU celestial canvas rendering with 4-level LOD zoom | UC1 | **[T], [D]** | `TC-CAN-001`, `TC-CAN-002`, `TC-CAN-003` | PASS |
| **FR-13** | Dynamic zoom-based stroke scaling across all connecting line types | UC1 | **[T], [A]** | `TC-CAN-004`, `TC-CAN-005`, `TC-CAN-006` | PASS |
| **FR-14** | 24-parameter D3 force-directed physics simulation engine | UC1 | **[T], [A]** | `TC-PHY-001`, `TC-PHY-002`, `TC-PHY-003`, `TC-PHY-004` | PASS |
| **FR-15** | Real-time dynamic physics parameter updates without canvas reloads | UC1 | **[T], [D]** | `TC-PHY-005`, `TC-PHY-006`, `TC-PHY-007`, `TC-PHY-008` | PASS |
| **FR-16** | Multi-Key AI Provider Engine with automated local/cloud discovery | UC4 | **[T], [D]** | `TC-AIP-001`, `TC-AIP-002`, `TC-AIP-003`, `TC-AIP-004` | PASS |
| **FR-17** | Tab memory retention across workspace switches with zero reload latency | UC2 | **[T], [D]** | `TC-MOD-001`, `TC-MOD-002` | PASS |
| **FR-18** | Ghost tab elimination during workspace folder switching | UC1, UC2 | **[T]** | `TC-MOD-003`, `TC-MOD-004` | PASS |

---

## 3. Non-Functional Requirements (NFR) Traceability

| NFR ID | Quality Attribute | Technical Target Metric | Verification Method | Associated Test Case IDs | Test Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **NFR-01** | **Rendering Performance** | Canvas maintains >= 58 FPS under 5,000 nodes during pan/zoom | **[A], [T]** | `TC-CAN-003`, `TC-CAN-005` | PASS |
| **NFR-02** | **AST Parsing Latency** | Full AST parse < 1,500 ms for repository of 500 files | **[A], [T]** | `TC-AST-006` | PASS |
| **NFR-03** | **WebSocket Latency** | In-memory message dispatch latency < 15 ms under peak load | **[A], [T]** | `TC-WSS-005` | PASS |
| **NFR-04** | **Memory Footprint** | Baseline idle memory < 450 MB; zero memory leaks after 50 tab switches | **[A], [T]** | `TC-MOD-002`, `TC-CAN-002` | PASS |
| **NFR-05** | **Path Traversal Security** | 100% rejection of unauthorized relative directory access (`../../`) | **[T]** | `TC-FIL-005` | PASS |
| **NFR-06** | **Refactor Integrity** | Lossless code comments and indentation preservation (zero diff drift) | **[I], [T]** | `TC-MUT-002` | PASS |

---

## 4. Use Case to Test Case Mapping

```
+------------------+------------------------------------------------+----------------------------+
| Use Case ID      | Use Case Name                                  | Mapped Test Cases          |
+------------------+------------------------------------------------+----------------------------+
| UC1              | Explore Spatial Codebase                       | TC-AST-001, TC-CAN-001..06 |
| UC2              | Edit & Mutate Code                             | TC-MUT-001..05, TC-FIL-001 |
| UC3              | Execute Code in Interactive Terminal           | TC-TRM-001..04             |
| UC4              | Request Graph-RAG AI Summary                   | TC-AIP-001..04, TC-BLS-001 |
| UC5              | Supervise AI & 1-Click Rollback                | TC-BLS-002, TC-BLS-003     |
| UC6              | Manage Git Version Control                     | TC-WSS-003, TC-FIL-004     |
| UC7              | Authenticate User Session                      | TC-AIP-003                 |
| UC8              | Compute Blast Radius Impact                    | TC-BLS-001, TC-BLS-005     |
| UC9              | Lossless AST Code Refactoring (LibCST)         | TC-MUT-001, TC-MUT-002     |
| UC10             | Validate CSP Dependency Constraints            | TC-AST-004, TC-AST-005     |
| UC11             | Capture Pre-Mutation File Snapshot             | TC-FIL-002, TC-BLS-003     |
| UC12             | Enforce Save Rate Throttling                   | TC-BLS-004                 |
+------------------+------------------------------------------------+----------------------------+
```

---

## 5. Traceability Coverage Statistics

- **Total Functional Requirements (FR):** 18
- **Total Non-Functional Requirements (NFR):** 6
- **Total System Use Cases (UC):** 12
- **Total Test Cases Specified:** 47
- **Requirements Coverage:** 100.0%
- **Use Case Coverage:** 100.0%
- **Unmapped Requirements:** 0
- **Orphaned Test Cases:** 0
