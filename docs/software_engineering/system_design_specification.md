# Neuron System Design Specification

This document provides a formal Software Engineering System Design for **Neuron (The Spatial IDE)**, covering Use Case Analysis, Data Flow Modeling (DFD Levels 0 and 1), Sequence Interactions, and State Transition Dynamics.

---

## 1. Use Case Diagram

### 1.1 Identification of Primary Actors
1. **Software Developer / Engineer (Primary User):** Navigates the codebase spatially, inspects code nodes, executes code, performs edits, triggers refactorings, manages Git workflows, and interacts with the AI assistant.
2. **AI Agent / Supervisor (Autonomous Secondary Actor):** Monitors code mutations, checks burst thresholds, performs Graph-RAG code summarization, executes tool actions, and proposes/applies multi-file refactorings.
3. **Host Operating System / Execution Runtime (Supporting Actor):** Executes polyglot subprocesses (Python, Node.js, Shell), runs file system operations, and provides standard I/O pipes.
4. **Cloud Auth Provider / Supabase (External Service):** Manages Google OAuth 2.0 PKCE authentication handshakes and session verification.
5. **LLM Provider (External / Local Inference Service):** Generates architectural summaries, code completions, and refactoring plans via Google Gemini or local Ollama.

### 1.2 Main Use Cases per Actor

#### Software Developer
- **UC1: Explore Spatial Codebase** (Pan, zoom, cluster view, search nodes)
- **UC2: Edit & Mutate Code** (In-node Monaco editor, direct file save)
- **UC3: Execute Code** (Polyglot native subprocess or in-browser Pyodide)
- **UC4: Request Graph-RAG AI Insights** (Node summary, impact blast radius)
- **UC5: Supervise AI & Manage Rollbacks** (Approve batch, rollback snapshot, toggle blast protection)
- **UC6: Manage Git Version Control** (Stage, commit, push, inspect visual Git DAG)
- **UC7: Authenticate User Session** (Google OAuth via Supabase PKCE)

#### AI Agent / Supervisor
- **UC8: Monitor Mutation Bursts & Blast Protection**
- **UC9: Lossless AST Code Refactoring** (LibCST & Tree-Sitter transformations)
- **UC10: Validate Circular Dependency Constraints (CSP Guard)**

### 1.3 Use Case Diagram (Mermaid)

```mermaid
flowchart LR
    Dev(["👤 Software Developer"])
    Supervisor(["🤖 AI Supervisor"])
    LLM(["☁️ LLM Service (Gemini / Ollama)"])
    HostOS(["💻 Host OS / Runtime"])
    Supabase(["🔐 Supabase Auth"])

    subgraph NeuronSystem ["Neuron Spatial IDE System Boundary"]
        UC1(["Explore Spatial Codebase"])
        UC2(["Edit Code in Obsidian Node"])
        UC3(["Execute Code / Subprocess"])
        UC4(["Request Graph-RAG AI Summary"])
        UC5(["Supervise AI & 1-Click Rollback"])
        UC6(["Manage Git Version Control"])
        UC7(["Authenticate Session"])

        UC8(["Compute Blast Radius Impact"])
        UC9(["Lossless AST Mutation (LibCST/Tree-Sitter)"])
        UC10(["Validate CSP Dependency Constraints"])
        UC11(["Capture Pre-Mutation File Snapshot"])
        UC12(["Enforce Save Rate Throttling"])
    end

    %% Actor Relationships
    Dev --> UC1
    Dev --> UC2
    Dev --> UC3
    Dev --> UC4
    Dev --> UC5
    Dev --> UC6
    Dev --> UC7

    Supervisor --> UC8
    Supervisor --> UC10
    Supervisor --> UC12

    UC4 --> LLM
    UC3 --> HostOS
    UC7 --> Supabase

    %% Include and Extend Relationships
    UC2 -.->|"<<include>>"| UC9
    UC9 -.->|"<<include>>"| UC10
    UC2 -.->|"<<extend>>"| UC12
    UC5 -.->|"<<include>>"| UC11
    UC4 -.->|"<<include>>"| UC8
```

---

## 2. Data Flow Diagrams (DFD)

### 2.1 Main Elements & Data Dictionary
- **External Entities:**
  - `Developer`: Initiates UI actions, keystrokes, and commands.
  - `Host File System (Disk)`: Stores physical source files, configurations, and git repositories.
  - `LLM Provider (Gemini / Ollama)`: Computes embeddings, summaries, and conversational responses.
  - `Supabase Auth Service`: Validates OAuth tokens and user profiles.
  - `Subprocess Runtime`: Local OS process executing code binaries.
- **Data Stores:**
  - `D1: Host Source Files`: Raw `.py`, `.js`, `.ts`, and asset files on local disk.
  - `D2: In-Memory Graph & AppState`: Active AST nodes, edges, betweenness metrics, and WebSocket connections.
  - `D3: Snapshot & Batch Transaction Store`: Pre-modification file snapshots for rollback operations.
  - `D4: Persistent Config (~/.neuron)`: Cached auth sessions, PKCE verifiers, and user settings.
  - `D5: Vector Search Memory Store`: Pure-RAM TF-IDF & N-Gram indices for sub-millisecond semantic search.

---

### 2.2 Context Diagram (Level 0 DFD)

```mermaid
flowchart TD
    Dev["👤 Developer / Client"]
    Disk["💾 Host File System"]
    LLM["☁️ LLM Provider (Gemini / Ollama)"]
    Auth["🔐 Supabase OAuth"]
    SubProc["⚙️ OS Subprocess Runtimes"]

    P0(("0.0<br/>Neuron Spatial IDE<br/>System"))

    Dev -->|"UI Events, Code Edits, Chat Prompts, Terminal Stdin"| P0
    P0 -->|"Visual Graph, AST Nodes, Terminal Stdout/Stderr, AI Stream"| Dev

    P0 -->|"Write Files, Create Snapshots, Git Commands"| Disk
    Disk -->|"Raw Code, Directory Tree, File Watcher Events"| P0

    P0 -->|"Graph-RAG Context, Code Snippets, User Prompts"| LLM
    LLM -->|"Tokens, JSON Refactor Diffs, Architectural Summaries"| P0

    P0 -->|"PKCE Auth Code & Verifier"| Auth
    Auth -->|"User Session, Access Tokens"| P0

    P0 -->|"Spawn Process, Shell Command, Stdin"| SubProc
    SubProc -->|"Stdout, Stderr, Exit Codes"| P0
```

---

### 2.3 Level 1 Data Flow Diagram

```mermaid
flowchart TD
    Dev["👤 Developer"]
    Disk["💾 Host File System"]
    LLM["☁️ LLM Engine"]

    %% Data Stores
    D1[("D1: Project Source Files")]
    D2[("D2: In-Memory AppState & Graph")]
    D3[("D3: Snapshot & Batch Transaction Log")]
    D4[("D4: Config Cache (~/.neuron)")]
    D5[("D5: Vector Index (Pure RAM)")]

    %% Processes
    P1(("1.0<br/>Watchdog & AST<br/>Parser Engine"))
    P2(("2.0<br/>WebSocket Event Hub<br/>& Dispatcher"))
    P3(("3.0<br/>Spatial Canvas &<br/>Physics Engine"))
    P4(("4.0<br/>AI Supervisor &<br/>Blast Shield"))
    P5(("5.0<br/>Polyglot Execution &<br/>Terminal Manager"))

    %% Flows
    Disk -->|"File Changed Event"| P1
    D1 -->|"Raw Source Code"| P1
    P1 -->|"AST Nodes, Edges & Metrics"| D2
    P1 -->|"Tokenized AST Nodes"| D5

    D2 -->|"Graph & Workspace Payload"| P2
    P2 <-->|"Bidirectional WS Events"| Dev
    P2 -->|"Render Nodes & Edges"| P3
    P3 -->|"Layout Position Updates"| D2

    Dev -->|"Code Edit / AI Refactor"| P2
    P2 -->|"Refactor Request / Batch"| P4
    P4 -->|"Pre-Edit Backup"| D3
    P4 -->|"Graph Context + Code"| LLM
    LLM -->|"Proposed AST Diff"| P4
    P4 -->|"Safe Lossless Write"| D1

    Dev -->|"Run Code / Shell Command"| P2
    P2 -->|"Execute Process"| P5
    D1 -->|"Target Script"| P5
    P5 -->|"Terminal Stdout/Stderr"| P2
```

---

## 3. Sequence Diagram

### 3.1 Use Case Selection
**Use Case:** *"Graph-RAG Node Inspection & AI Refactoring with Agent Supervisor Blast Protection & Rollback"*

### 3.2 Participating Objects & Components
1. `Dev`: Developer / User
2. `Canvas`: React Frontend (`ObsidianNode` / `PixiSpatialEngine`)
3. `WSRouter`: FastAPI WebSocket Router (`api/websocket_router.py`)
4. `Supervisor`: Agent Supervisor & Blast Shield (`ai/agent_supervisor.py`)
5. `LLM`: AI Inference Service (`services/ai_service.py` via Gemini 3.8 / Ollama)
6. `Mutator`: AST Engine (`core/mutator.py` LibCST / Tree-Sitter)
7. `Disk`: Physical Host Storage (`D1` Source Files & `D3` Snapshots)

### 3.3 Sequence Diagram (Mermaid)

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer
    participant Canvas as Frontend Spatial Canvas
    participant WSRouter as WebSocket Router (/ws)
    participant Supervisor as Agent Supervisor (Blast Shield)
    participant LLM as AI Service (Gemini / Ollama)
    participant Mutator as AST Mutator (LibCST)
    participant Disk as Host File System

    Note over Dev,Canvas: Step 1: User requests AI Refactor on a Node
    Dev->>Canvas: Clicks "Refactor Function" on ObsidianNode
    Canvas->>WSRouter: send_json("AI_CHAT_STREAM", {prompt, node_id, file})
    
    Note over WSRouter,LLM: Step 2: Assemble Graph-RAG Architectural Context
    WSRouter->>WSRouter: Extract caller/callee AST edges from AppState
    WSRouter->>LLM: stream_antigravity_chat(code, connected_snippets, risk)
    
    loop Token Streaming
        LLM-->>WSRouter: yield token / thought / proposed_diff
        WSRouter-->>Canvas: send_json("AI_CHAT_DELTA" / "AI_CHAT_THOUGHT")
        Canvas-->>Dev: Live Typewriter HUD update
    end

    Note over Dev,Supervisor: Step 3: Approve & Execute Refactor with Blast Guard
    Dev->>Canvas: Clicks "Apply Refactor"
    Canvas->>WSRouter: send_json("AI_APPLY_REFACTOR", {target_file, proposed_code})
    WSRouter->>Supervisor: register_file_modification(target_file)
    
    alt Rapid Save Flood (>6 saves/sec)
        Supervisor-->>WSRouter: Intercept: Blast Protection Triggered
        WSRouter-->>Canvas: send_json("SAVE_FILE_ERROR", {reason: "Throttled"})
    else Safe Rate Allowed
        Supervisor->>Disk: Capture Pre-Mutation Snapshot (.bak in D3)
        Supervisor->>Mutator: apply_refactor_code(target_file, proposed_code)
        Mutator->>Mutator: Validate CST Syntax & CSP Constraints
        Mutator->>Disk: Lossless Atomic Write to disk
        Disk-->>WSRouter: File Watcher Triggered (Watchdog)
        WSRouter-->>Canvas: broadcast("SYNC", updated_graph_state)
        Canvas-->>Dev: Node updates on canvas & HUD displays Batch ID
    end

    opt User Rejects or Tests Fail (1-Click Rollback)
        Dev->>Canvas: Clicks "Rollback Batch"
        Canvas->>WSRouter: send_json("AGENT_ROLLBACK_BATCH", {batch_id})
        WSRouter->>Supervisor: rollback_batch(batch_id)
        Supervisor->>Disk: Restore snapshot files from D3
        WSRouter-->>Canvas: broadcast("SYNC", restored_graph)
        Canvas-->>Dev: Canvas smoothly reverts to pre-mutation state
    end
```

---

## 4. State Transition Diagram

### 4.1 Chosen Entity
**Entity:** `AgentBatch` / `RefactorTransaction` (The lifecycle of an automated or AI-assisted codebase modification in Neuron).

### 4.2 State Identification
- **`IDLE`**: System is quiescent; awaiting user or agent mutation request.
- **`SNAPSHOT_RECORDING`**: Capturing file content hashes and pre-edit disk backups.
- **`RATE_EVALUATION`**: Burst monitor inspects the sliding timestamp window (checks if save rate $> 6\text{ saves/s}$).
- **`BLOCKED_BURST`**: Mutation intercepted and halted by Blast Protection shield.
- **`AST_VALIDATION`**: Parsing code with LibCST / Tree-Sitter to confirm syntactic validity and acyclic CSP dependencies.
- **`AWAITING_APPROVAL`**: Mutation written to disk; batch is active and highlighted on the Agent Supervisor HUD.
- **`COMMITTED`**: User approves changes; snapshots marked as resolved.
- **`ROLLED_BACK`**: User or automated rule rejects batch; pre-edit snapshots are re-written to disk.
- **`REAPPLIED`**: User chooses to redo a rolled-back transaction.

### 4.3 Transition Events
1. `TRIGGER_REFACTOR`: User or AI initiates code modification.
2. `SNAPSHOT_CREATED`: File state captured into rollback buffer.
3. `RATE_OK`: Save frequency $\le 6\text{ ops/sec}$.
4. `BURST_DETECTED`: Save frequency $> 6\text{ ops/sec}$.
5. `AST_VALID`: Code compiles into valid Concrete Syntax Tree with no circular imports.
6. `AST_INVALID`: Syntax error or CSP constraint violation detected.
7. `USER_APPROVE`: Developer confirms modification via HUD.
8. `USER_ROLLBACK`: Developer clicks 1-Click Rollback.
9. `USER_REAPPLY`: Developer clicks Reapply.
10. `PURGE_BATCH`: Batch expired or dismissed.

### 4.4 State Transition Diagram (Mermaid)

```mermaid
stateDiagram-v2
    [*] --> IDLE

    IDLE --> SNAPSHOT_RECORDING : TRIGGER_REFACTOR
    
    SNAPSHOT_RECORDING --> RATE_EVALUATION : SNAPSHOT_CREATED
    
    RATE_EVALUATION --> BLOCKED_BURST : BURST_DETECTED (>6 saves/sec)
    BLOCKED_BURST --> IDLE : DISMISS_NOTIFICATION

    RATE_EVALUATION --> AST_VALIDATION : RATE_OK (<=6 saves/sec)

    AST_VALIDATION --> IDLE : AST_INVALID / CSP_VIOLATION (Auto-Aborted)
    
    AST_VALIDATION --> AWAITING_APPROVAL : AST_VALID (Atomic Disk Write)

    state AWAITING_APPROVAL {
        [*] --> PendingReview
        PendingReview --> PendingReview : Visual_Inspection
    }

    AWAITING_APPROVAL --> COMMITTED : USER_APPROVE
    AWAITING_APPROVAL --> ROLLED_BACK : USER_ROLLBACK

    ROLLED_BACK --> REAPPLIED : USER_REAPPLY
    REAPPLIED --> AWAITING_APPROVAL : Disk_Reapplied

    COMMITTED --> IDLE : PURGE_BATCH
    ROLLED_BACK --> IDLE : DISMISS_BATCH

    IDLE --> [*]
```

---

## 5. Summary Matrix of Design Artifacts

| UML / System Artifact | Primary Mechanism | Purpose in Neuron Architecture |
| :--- | :--- | :--- |
| **Use Case Diagram** | Actor-Goal interactions | Defines human developer vs. autonomous supervisor boundaries |
| **Context Diagram (Level 0)** | Black-box boundary mapping | Maps external I/O (Disk, Supabase, LLMs, Subprocesses) |
| **Level 1 DFD** | Process & Store decomposition | Details real-time flow between Watchdog, WebSocket Hub, and Memory Stores |
| **Sequence Diagram** | Chronological message tracing | Demonstrates Graph-RAG context synthesis, blast protection, and rollback |
| **State Diagram** | Entity lifecycle modeling | Guarantees transactional safety and deterministic recovery of code states |
