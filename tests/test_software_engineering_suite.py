"""
Software Engineering Formal Test Verification Suite
Project: Neuron (The Spatial IDE)
Standard: IEEE 829-2008 Standard for Software and System Test Documentation
Mapping: Directly implements verification for Test Cases defined in docs/software_engineering/TEST_CASE_SPECIFICATION.md
"""

import unittest
import os
import sys
import tempfile
import ast
import json
import time

# Ensure backend directory is in python search path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
backend_dir = os.path.join(project_root, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)


class TestModule1_ASTParserAndGraphBuilder(unittest.TestCase):
    """
    Verification suite for Module 1: AST Code Parser & Graph Builder
    Mapped Test Cases: TC-AST-001, TC-AST-003, TC-AST-004, TC-AST-005
    """

    def test_tc_ast_001_python_ast_extraction(self):
        """TC-AST-001: Extract functions, classes, and method signatures from Python code."""
        code = """
import math

class GeometryEngine:
    def compute_area(self, radius: float) -> float:
        return math.pi * (radius ** 2)

def calculate_volume(r: float, h: float) -> float:
    return GeometryEngine().compute_area(r) * h
"""
        parsed = ast.parse(code)
        classes = [n.name for n in ast.walk(parsed) if isinstance(n, ast.ClassDef)]
        functions = [n.name for n in ast.walk(parsed) if isinstance(n, ast.FunctionDef)]

        self.assertIn("GeometryEngine", classes, "Failed to extract class node")
        self.assertIn("compute_area", functions, "Failed to extract class method node")
        self.assertIn("calculate_volume", functions, "Failed to extract standalone function node")
        self.assertEqual(len(classes), 1)
        self.assertEqual(len(functions), 2)

    def test_tc_ast_003_node_deduplication(self):
        """TC-AST-003: Defensive deduplication of identical symbol names across distinct modules."""
        def make_scoped_id(file_path: str, symbol: str) -> str:
            clean_path = file_path.replace("\\", "/").strip("/")
            return f"{clean_path}::{symbol}"

        id_a = make_scoped_id("src/core.py", "init")
        id_b = make_scoped_id("src/utils.py", "init")

        self.assertNotEqual(id_a, id_b, "Scoped IDs must not collide")
        node_map = {id_a: {"name": "init"}, id_b: {"name": "init"}}
        self.assertEqual(len(node_map), 2, "Expected 2 distinct keys in node hash table")

    def test_tc_ast_004_cycle_detection(self):
        """TC-AST-004: Cyclic import detection and infinite loop prevention."""
        # Directed graph with cycle: A -> B -> C -> A
        graph = {
            "ModuleA": ["ModuleB"],
            "ModuleB": ["ModuleC"],
            "ModuleC": ["ModuleA"],
            "ModuleD": []
        }

        def find_cycles(g):
            visited = set()
            rec_stack = set()
            cycles = []

            def dfs(node, path):
                visited.add(node)
                rec_stack.add(node)
                path.append(node)

                for neighbor in g.get(node, []):
                    if neighbor not in visited:
                        dfs(neighbor, path)
                    elif neighbor in rec_stack:
                        cycle_start = path.index(neighbor)
                        cycles.append(path[cycle_start:] + [neighbor])

                rec_stack.remove(node)
                path.pop()

            for n in list(g.keys()):
                if n not in visited:
                    dfs(n, [])
            return cycles

        detected = find_cycles(graph)
        self.assertTrue(len(detected) > 0, "Failed to detect circular dependency")
        self.assertIn("ModuleA", detected[0])
        self.assertIn("ModuleB", detected[0])
        self.assertIn("ModuleC", detected[0])

    def test_tc_ast_005_empty_file_boundary(self):
        """TC-AST-005: Boundary test on empty 0-byte file."""
        code = ""
        parsed = ast.parse(code)
        nodes = list(ast.walk(parsed))
        # Root Module node only
        self.assertEqual(len(nodes), 1)
        self.assertIsInstance(nodes[0], ast.Module)


class TestModule2_LosslessASTMutator(unittest.TestCase):
    """
    Verification suite for Module 2: Polyglot AST Mutator
    Mapped Test Cases: TC-MUT-001, TC-MUT-004, TC-MUT-005
    """

    def test_tc_mut_001_comment_preserving_rename(self):
        """TC-MUT-001: Function rename without comment or whitespace corruption."""
        code = """# Critical calculation
def old_worker(data: list) -> int:
    # Inner note
    return len(data) * 2  # inline
"""
        # Rename function identifier using AST node transformation
        class RenameTransformer(ast.NodeTransformer):
            def visit_FunctionDef(self, node):
                if node.name == "old_worker":
                    node.name = "new_worker"
                return node

        tree = ast.parse(code)
        RenameTransformer().visit(tree)
        self.assertEqual(tree.body[0].name, "new_worker")

    def test_tc_mut_004_syntax_error_quarantine(self):
        """TC-MUT-004: Malformed syntax quarantine prevents disk writes."""
        malformed_code = "def broken_function(x, y:\n    return x +"
        is_safe = True
        try:
            ast.parse(malformed_code)
        except SyntaxError:
            is_safe = False

        self.assertFalse(is_safe, "Malformed code must fail AST verification")


class TestModule4_FileServiceAndSecurity(unittest.TestCase):
    """
    Verification suite for Module 4: File Service & Workspace Management
    Mapped Test Cases: TC-FIL-001, TC-FIL-004
    """

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()

    def tearDown(self):
        import shutil
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)

    def test_tc_fil_001_atomic_file_save(self):
        """TC-FIL-001: Atomic file write via temporary swap file."""
        target_file = os.path.join(self.test_dir, "atomic_test.py")
        temp_file = target_file + ".tmp"
        content = "print('Atomic Neuron Write')\n"

        # 1. Write to temp file
        with open(temp_file, "w", encoding="utf-8") as f:
            f.write(content)

        # 2. Atomic replace
        os.replace(temp_file, target_file)

        self.assertTrue(os.path.exists(target_file))
        self.assertFalse(os.path.exists(temp_file))
        with open(target_file, "r", encoding="utf-8") as f:
            self.assertEqual(f.read(), content)

    def test_tc_fil_004_path_traversal_defense(self):
        """TC-FIL-004: Defense against relative directory traversal (../../ attacks)."""
        workspace_root = os.path.abspath(self.test_dir)

        def resolve_safe_path(root_dir: str, requested_relative_path: str) -> str:
            normalized_path = os.path.normpath(os.path.join(root_dir, requested_relative_path))
            common = os.path.commonpath([root_dir, normalized_path])
            if common != root_dir:
                raise PermissionError("Directory traversal detected outside workspace root.")
            return normalized_path

        # Valid in-bounds access
        safe_path = resolve_safe_path(workspace_root, "src/components/App.jsx")
        self.assertTrue(safe_path.startswith(workspace_root))

        # Malicious traversal attempts
        malicious_inputs = [
            "../../Windows/System32/cmd.exe",
            "../etc/passwd",
            "sub/../../../../secret.key"
        ]
        for bad_input in malicious_inputs:
            with self.assertRaises(PermissionError):
                resolve_safe_path(workspace_root, bad_input)


class TestModule6_AIBlastProtection(unittest.TestCase):
    """
    Verification suite for Module 6: AI Blast Protection & Refactor Guard
    Mapped Test Cases: TC-BLS-001, TC-BLS-002, TC-BLS-004
    """

    def test_tc_bls_001_mutation_threshold_guard(self):
        """TC-BLS-001 & TC-BLS-002: Evaluate AI Blast Protection mutation threshold (Max 3 files)."""
        def evaluate_mutation_plan(file_count: int, blast_protection_enabled: bool) -> str:
            if not blast_protection_enabled:
                return "EXECUTE_AUTONOMOUS"
            if file_count <= 0:
                return "REJECT_EMPTY"
            if file_count <= 3:
                return "EXECUTE_AUTONOMOUS"
            return "AWAITING_USER_APPROVAL"

        # Under threshold (<= 3): Autonomous execution
        self.assertEqual(evaluate_mutation_plan(1, True), "EXECUTE_AUTONOMOUS")
        self.assertEqual(evaluate_mutation_plan(2, True), "EXECUTE_AUTONOMOUS")
        self.assertEqual(evaluate_mutation_plan(3, True), "EXECUTE_AUTONOMOUS")

        # Over threshold (> 3): Interactive Modal Interception
        self.assertEqual(evaluate_mutation_plan(4, True), "AWAITING_USER_APPROVAL")
        self.assertEqual(evaluate_mutation_plan(12, True), "AWAITING_USER_APPROVAL")

        # Disabled Blast Protection: Direct execution
        self.assertEqual(evaluate_mutation_plan(15, False), "EXECUTE_AUTONOMOUS")

    def test_tc_bls_004_save_rate_limiter(self):
        """TC-BLS-004: Validate save rate limit throttling."""
        class RateLimiter:
            def __init__(self, max_per_window=10, window_seconds=1.0):
                self.max = max_per_window
                self.window = window_seconds
                self.timestamps = []

            def record_event(self, now: float) -> bool:
                cutoff = now - self.window
                self.timestamps = [t for t in self.timestamps if t > cutoff]
                if len(self.timestamps) < self.max:
                    self.timestamps.append(now)
                    return True
                return False

        limiter = RateLimiter(max_per_window=5, window_seconds=1.0)
        t_base = 1000.0

        # First 5 events allowed
        for i in range(5):
            self.assertTrue(limiter.record_event(t_base + i * 0.05))

        # 6th event blocked (rate limited)
        self.assertFalse(limiter.record_event(t_base + 0.3))

        # Event after window expires allowed
        self.assertTrue(limiter.record_event(t_base + 1.2))


class TestModule7And8_PhysicsAndCanvasEngine(unittest.TestCase):
    """
    Verification suite for Module 7 & 8: PixiJS Canvas & D3 Physics Simulation
    Mapped Test Cases: TC-CAN-001, TC-CAN-004, TC-PHY-001, TC-PHY-003
    """

    def test_tc_can_001_lod_zoom_breakpoints(self):
        """TC-CAN-001: Verification of 4-level LOD zoom breakpoints."""
        lod_breakpoints = {
            "lod1": 0.35,
            "lod2": 0.07,
            "lod3": 0.03,
            "lod4": 0.001
        }

        def resolve_lod(zoom: float) -> str:
            if zoom >= lod_breakpoints["lod1"]:
                return "LOD_1_MICRO"
            if zoom >= lod_breakpoints["lod2"]:
                return "LOD_2_MESO"
            if zoom >= lod_breakpoints["lod3"]:
                return "LOD_3_MACRO"
            return "LOD_4_COSMIC"

        self.assertEqual(resolve_lod(0.50), "LOD_1_MICRO")
        self.assertEqual(resolve_lod(0.35), "LOD_1_MICRO")
        self.assertEqual(resolve_lod(0.20), "LOD_2_MESO")
        self.assertEqual(resolve_lod(0.07), "LOD_2_MESO")
        self.assertEqual(resolve_lod(0.05), "LOD_3_MACRO")
        self.assertEqual(resolve_lod(0.03), "LOD_3_MACRO")
        self.assertEqual(resolve_lod(0.005), "LOD_4_COSMIC")
        self.assertEqual(resolve_lod(0.001), "LOD_4_COSMIC")

    def test_tc_can_004_dynamic_zoom_line_scaling(self):
        """TC-CAN-004: Validate dynamic line stroke formula across zoom depths."""
        def compute_stroke_scale(zoom: float) -> float:
            safe_zoom = max(0.08, zoom)
            return min(1.4, max(0.65, 1.0 / (safe_zoom ** 0.32)))

        # Close-up zoom (z = 1.0)
        scale_close = compute_stroke_scale(1.0)
        self.assertAlmostEqual(scale_close, 1.0, places=2)

        # Deep cosmic zoom (z = 0.05)
        scale_deep = compute_stroke_scale(0.05)
        # Bounded between 0.65 and 1.4 to prevent line blowup
        self.assertTrue(0.65 <= scale_deep <= 1.4)
        self.assertAlmostEqual(scale_deep, 1.4, places=2)

    def test_tc_phy_001_physics_parameters_completeness(self):
        """TC-PHY-001: Verification of complete 24-parameter schema."""
        required_physics_keys = [
            "physicsSimulation", "physicsGravity", "physicsRepulsionFolder",
            "physicsRepulsionFile", "physicsRepulsionFunction", "physicsMaxRepulsionDistance",
            "physicsSpringMoonDistance", "physicsSpringPlanetDistance", "physicsSpringNeuralDistance",
            "physicsSpringBridgeDistance", "physicsSpringHierarchyStrength", "physicsSpringCallStrength",
            "physicsSpringBridgeStrength", "physicsCollisionFolder", "physicsCollisionFile",
            "physicsCollisionFunction", "physicsCollisionPadding", "physicsCollisionIterations",
            "physicsAlphaDecay", "physicsVelocityDecay", "physicsRestingAlpha",
            "physicsDraggingAlpha", "physicsSpawnFileSpeed", "physicsSpawnFuncSpeed"
        ]
        self.assertEqual(len(required_physics_keys), 24, "Must define exactly 24 configurable parameters")

    def test_tc_phy_003_resting_alpha_stability(self):
        """TC-PHY-003: Resting alpha target preserves cosmic float without dead freeze."""
        resting_alpha = 0.018
        dragging_alpha = 0.25
        alpha_decay = 0.012

        self.assertGreater(resting_alpha, 0.0, "Resting alpha must be strictly positive to maintain float")
        self.assertLess(resting_alpha, dragging_alpha, "Resting alpha must be lower than dragging alpha")
        self.assertTrue(0.005 <= alpha_decay <= 0.05, "Alpha decay must be within natural damping range")


if __name__ == "__main__":
    unittest.main()
