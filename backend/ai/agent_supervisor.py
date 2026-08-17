# backend/ai/agent_supervisor.py
import difflib
import os
import posixpath
import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

import networkx as nx
from core.state import AppState


@dataclass
class ASTSymbolDelta:
    """Represents changes to specific functions or classes within a file."""
    symbol_name: str
    change_type: str  # 'ADDED', 'MODIFIED', 'DELETED'
    line_start: int = 1
    old_signature: Optional[str] = None
    new_signature: Optional[str] = None


@dataclass
class FileMutationDelta:
    """Represents changes to a single file within a mutation batch."""
    file_path: str
    status: str  # 'MODIFIED', 'CREATED', 'DELETED'
    loc_delta: int = 0
    symbols_added: List[str] = field(default_factory=list)
    symbols_modified: List[str] = field(default_factory=list)
    symbols_deleted: List[str] = field(default_factory=list)
    raw_diff: str = ""
    original_content: str = ""


@dataclass
class AgentMutationBatch:
    """Represents a unified batch of multi-file edits performed by an AI agent or developer."""
    batch_id: str
    timestamp: float
    modified_files: List[str]
    file_deltas: Dict[str, FileMutationDelta]
    blast_radius_node_ids: List[str]
    affected_api_routes: List[str]
    is_committed: bool = False
    is_rolled_back: bool = False


class AgentSupervisorEngine:
    """
    🌌 THE AI AGENT SUPERVISOR ENGINE (Horizon 3)
      - Intercepts rapid multi-file mutation bursts from AI coding agents (Claude, Aider, Cursor, Ollama).
      - Computes AST deltas and full transitive downstream blast radius.
      - Maintains an atomic rollback vault for 1-click PR rollbacks.
      - Generates hot graph patch deltas to prevent full-canvas reloads.
    """
    def __init__(self):
        self.active_batches: Dict[str, AgentMutationBatch] = {}
        self.file_content_snapshots: Dict[str, str] = {}
        self.current_burst_id: Optional[str] = None
        self.burst_timeout_seconds: float = 1.8
        self.last_mutation_time: float = 0.0

    def capture_file_snapshot(self, rel_path: str, content: str) -> None:
        """Saves a pre-mutation baseline snapshot of a file."""
        clean_path = rel_path.replace("\\", "/").lstrip("/")
        if clean_path not in self.file_content_snapshots:
            self.file_content_snapshots[clean_path] = content

    def compute_ast_delta(
        self, 
        rel_path: str, 
        old_content: str, 
        new_content: str
    ) -> FileMutationDelta:
        """
        Computes granular symbol-level diffs (added/modified/deleted functions)
        between two revisions of a file.
        """
        clean_path = rel_path.replace("\\", "/").lstrip("/")
        old_lines = old_content.splitlines()
        new_lines = new_content.splitlines()

        loc_delta = len(new_lines) - len(old_lines)

        # Generate Unified Diff
        diff_generator = difflib.unified_diff(
            old_lines, new_lines,
            fromfile=f"a/{clean_path}",
            tofile=f"b/{clean_path}",
            lineterm=""
        )
        raw_diff = "\n".join(diff_generator)

        # Extract top-level symbol signatures from old and new revisions
        def extract_symbol_map(code: str) -> Dict[str, str]:
            syms = {}
            # Python defs
            for m in re.finditer(r'^(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\([^)]*\)', code, re.MULTILINE):
                syms[m.group(1)] = m.group(0).strip()
            # JS/TS components & functions
            for m in re.finditer(r'(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\([^)]*\)', code):
                syms[m.group(1)] = m.group(0).strip()
            for m in re.finditer(r'(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>', code):
                syms[m.group(1)] = m.group(0).strip()
            return syms

        old_syms = extract_symbol_map(old_content)
        new_syms = extract_symbol_map(new_content)

        symbols_added = [s for s in new_syms if s not in old_syms]
        symbols_deleted = [s for s in old_syms if s not in new_syms]
        symbols_modified = [
            s for s in new_syms 
            if s in old_syms and new_syms[s] != old_syms[s]
        ]

        status = "MODIFIED"
        if not old_content and new_content:
            status = "CREATED"
        elif old_content and not new_content:
            status = "DELETED"

        return FileMutationDelta(
            file_path=clean_path,
            status=status,
            loc_delta=loc_delta,
            symbols_added=symbols_added,
            symbols_modified=symbols_modified,
            symbols_deleted=symbols_deleted,
            raw_diff=raw_diff,
            original_content=old_content
        )

    def compute_transitive_blast_radius(
        self, 
        modified_file_paths: List[str], 
        graph_edges: List[dict]
    ) -> Tuple[List[str], List[str]]:
        """
        Computes the complete transitive downstream blast radius across the graph.
        Identifies all functions, callers, files, and API bridges affected by the modified files.
        """
        DiG = nx.DiGraph()
        bridge_map = {}

        for edge in graph_edges:
            src = str(edge.get("source", ""))
            tgt = str(edge.get("target", ""))
            etype = edge.get("type", "")

            if src and tgt:
                # Flow of impact: If B depends on A (call or import), editing A impacts B
                DiG.add_edge(tgt, src)

                if etype == "network_bridge":
                    bridge_map[src] = tgt
                    bridge_map[tgt] = src

        impacted_node_set: Set[str] = set()
        affected_api_routes: Set[str] = set()

        for fpath in modified_file_paths:
            impacted_node_set.add(fpath)
            
            # Find all nodes in the DAG that start with this file path
            matching_nodes = [n for n in DiG.nodes if n.startswith(fpath)]
            for node_id in matching_nodes:
                impacted_node_set.add(node_id)
                try:
                    # Collect all downstream dependents
                    descendants = nx.descendants(DiG, node_id)
                    impacted_node_set.update(descendants)
                except Exception:
                    pass

        # Check for impacted laser network bridges
        for node_id in list(impacted_node_set):
            if node_id in bridge_map:
                impacted_node_set.add(bridge_map[node_id])
                affected_api_routes.add(bridge_map[node_id])

        return list(impacted_node_set), list(affected_api_routes)

    def record_agent_mutation_burst(
        self, 
        mutated_files: List[Tuple[str, str, str]],  # List of (rel_path, old_content, new_content)
        graph_edges: List[dict]
    ) -> AgentMutationBatch:
        """
        Groups multi-file edits into a tracked batch with live blast radius calculations.
        """
        now = time.time()
        
        # Determine if part of existing burst window or new batch
        if not self.current_burst_id or (now - self.last_mutation_time > self.burst_timeout_seconds):
            self.current_burst_id = f"batch_{int(now * 1000)}"

        batch_id = self.current_burst_id
        self.last_mutation_time = now

        file_deltas: Dict[str, FileMutationDelta] = {}
        modified_paths: List[str] = []

        for rel_path, old_text, new_text in mutated_files:
            clean_path = rel_path.replace("\\", "/").lstrip("/")
            modified_paths.append(clean_path)
            
            # Ensure baseline snapshot is preserved
            self.capture_file_snapshot(clean_path, old_text)

            delta = self.compute_ast_delta(clean_path, old_text, new_text)
            file_deltas[clean_path] = delta

        # Compute full blast radius across entire repository
        blast_nodes, api_routes = self.compute_transitive_blast_radius(modified_paths, graph_edges)

        batch = AgentMutationBatch(
            batch_id=batch_id,
            timestamp=now,
            modified_files=modified_paths,
            file_deltas=file_deltas,
            blast_radius_node_ids=blast_nodes,
            affected_api_routes=api_routes
        )

        self.active_batches[batch_id] = batch
        return batch

    def rollback_batch(self, batch_id: str, workspace_root: str) -> Tuple[bool, str]:
        """
        Reverts all files in the batch back to their exact pre-agent state on disk.
        """
        if batch_id not in self.active_batches:
            return False, f"Batch '{batch_id}' not found in active supervisor vault."

        batch = self.active_batches[batch_id]
        if batch.is_rolled_back:
            return False, f"Batch '{batch_id}' has already been rolled back."

        try:
            for fpath, delta in batch.file_deltas.items():
                abs_path = os.path.join(workspace_root, fpath)
                
                if delta.status == "CREATED":
                    if os.path.exists(abs_path):
                        os.remove(abs_path)
                else:
                    if delta.original_content:
                        with open(abs_path, "w", encoding="utf-8") as f:
                            f.write(delta.original_content)

            batch.is_rolled_back = True
            return True, f"Successfully rolled back batch {batch_id} across {len(batch.modified_files)} files."
        except Exception as e:
            return False, f"Rollback failed during disk write: {e}"

    def get_latest_batch_summary(self) -> Optional[dict]:
        """Returns JSON-serializable telemetry of the latest active agent batch."""
        if not self.active_batches:
            return None

        latest_id = list(self.active_batches.keys())[-1]
        batch = self.active_batches[latest_id]

        deltas_summary = []
        for fpath, delta in batch.file_deltas.items():
            deltas_summary.append({
                "filePath": fpath,
                "status": delta.status,
                "locDelta": delta.loc_delta,
                "symbolsAdded": delta.symbols_added,
                "symbolsModified": delta.symbols_modified,
                "symbolsDeleted": delta.symbols_deleted,
                "diffSnippet": delta.raw_diff[:1500]
            })

        return {
            "batchId": batch.batch_id,
            "timestamp": batch.timestamp,
            "modifiedFilesCount": len(batch.modified_files),
            "modifiedFiles": batch.modified_files,
            "blastRadiusCount": len(batch.blast_radius_node_ids),
            "blastRadiusNodeIds": batch.blast_radius_node_ids,
            "affectedApiRoutes": batch.affected_api_routes,
            "fileDeltas": deltas_summary,
            "isRolledBack": batch.is_rolled_back
        }


# Global Singleton Agent Supervisor Engine
agent_supervisor = AgentSupervisorEngine()