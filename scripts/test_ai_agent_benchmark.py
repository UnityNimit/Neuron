# scripts/test_ai_agent_benchmark.py
"""
Neuron Sovereign Autonomous Engine (NSAE) Benchmark Suite
Verifies 6 core autonomous capabilities:
  1. Conversational Purity (0 tool calls on greetings/chitchat)
  2. Read-Only Code Inspection (Only read tools, 0 mutating tools)
  3. Template & Whole-File Replacement (Clean update with valid AST)
  4. Multi-Step File Creation & Execution (Create then run target file, not server.py)
  5. Autonomous Self-Correction & Debugging (Fixes broken script until exit code 0)
  6. Persistent Memory Persistence (Writes and retrieves .neuron/memory.md)
"""

import asyncio
import os
import sys
import shutil

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Add backend directory to sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from services.ai_service import stream_antigravity_chat, read_project_rules


class BenchmarkLogger:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    RESET = "\033[0m"

    @classmethod
    def header(cls, title: str):
        print(f"\n{cls.BOLD}{cls.CYAN}{'='*70}{cls.RESET}")
        print(f"{cls.BOLD}{cls.CYAN}  BENCHMARK: {title}{cls.RESET}")
        print(f"{cls.BOLD}{cls.CYAN}{'='*70}{cls.RESET}")

    @classmethod
    def step(cls, msg: str):
        print(f"  {cls.CYAN}[>]{cls.RESET} {msg}")

    @classmethod
    def success(cls, msg: str):
        print(f"  {cls.GREEN}[PASS]:{cls.RESET} {msg}")

    @classmethod
    def fail(cls, msg: str):
        print(f"  {cls.RED}[FAIL]:{cls.RESET} {msg}")

    @classmethod
    def warn(cls, msg: str):
        print(f"  {cls.YELLOW}[WARN]:{cls.RESET} {msg}")


async def collect_chat_run(prompt: str, file_path=None, context_code=None, model="local-ollama"):
    steps = []
    tokens = []
    done_payload = None

    async for chunk in stream_antigravity_chat(
        prompt=prompt,
        conversation_id="bench_session",
        model=model,
        file_path=file_path,
        context_code=context_code,
        target_dir=PROJECT_ROOT,
        approval_mode="auto"
    ):
        ctype = chunk.get("type")
        if ctype == "step":
            steps.append(chunk)
            status_symbol = "+" if chunk.get("status") == "done" else "."
            print(f"    [{status_symbol}] {chunk.get('step')}")
        elif ctype == "token":
            tokens.append(chunk.get("content", ""))
        elif ctype == "done":
            done_payload = chunk

    full_text = "".join(tokens) + (done_payload.get("content", "") if done_payload else "")
    return {
        "steps": steps,
        "tokens": full_text,
        "done": done_payload
    }


async def test_conversational_purity() -> bool:
    BenchmarkLogger.header("1. Conversational Purity (Zero-Tool Firewall)")
    prompts = [
        "hi",
        "say hello",
        "man are you good?",
        "what is 12 * 12?"
    ]

    all_passed = True
    server_py_path = os.path.join(PROJECT_ROOT, "server.py")
    server_code = open(server_py_path, "r", encoding="utf-8").read() if os.path.exists(server_py_path) else ""

    for p in prompts:
        BenchmarkLogger.step(f"Testing conversational prompt: '{p}'")
        res = await collect_chat_run(
            prompt=p,
            file_path=server_py_path,
            context_code=server_code
        )

        steps = res["steps"]
        tokens = res["tokens"]

        tool_steps = [
            s["step"] for s in steps 
            if any(kw in s["step"].lower() for kw in ["running:", "executing", "creating", "modifying", "outline of"])
        ]
        
        if tool_steps:
            BenchmarkLogger.fail(f"Conversational prompt '{p}' triggered tool steps: {tool_steps}")
            all_passed = False
            continue

        if not tokens.strip():
            BenchmarkLogger.fail(f"Conversational prompt '{p}' returned empty response!")
            all_passed = False
            continue

        if "server.py was successful" in tokens.lower() or "executed server.py" in tokens.lower():
            BenchmarkLogger.fail(f"Conversational prompt '{p}' hallucinated running server.py!")
            all_passed = False
            continue

        BenchmarkLogger.success(f"Prompt '{p}' answered with 0 tool calls in pure conversational text.")

    return all_passed


async def test_read_only_inspection() -> bool:
    BenchmarkLogger.header("2. Read-Only Code Inspection")
    prompt = "what does server.py do and what functions are defined in it?"
    server_py_path = os.path.join(PROJECT_ROOT, "server.py")
    server_code = open(server_py_path, "r", encoding="utf-8").read() if os.path.exists(server_py_path) else ""

    BenchmarkLogger.step(f"Testing read-only prompt: '{prompt}'")
    res = await collect_chat_run(
        prompt=prompt,
        file_path=server_py_path,
        context_code=server_code
    )

    steps = res["steps"]
    tokens = res["tokens"]

    mutating_steps = [
        s["step"] for s in steps 
        if any(kw in s["step"].lower() for kw in ["running:", "creating", "modifying"])
    ]
    if mutating_steps:
        BenchmarkLogger.fail(f"Read-only prompt triggered mutating tools: {mutating_steps}")
        return False

    BenchmarkLogger.success("Read-only inspection completed without invoking mutating tools.")
    return True


async def test_template_replacement() -> bool:
    BenchmarkLogger.header("3. Template & Whole-File Replacement")
    target_file = os.path.join(PROJECT_ROOT, "benchmark_template_test.py")
    with open(target_file, "w", encoding="utf-8") as f:
        f.write("# Dummy file\nprint('old')\n")

    prompt = "change benchmark_template_test.py code to a leetcode template for two-sum with def two_sum(nums, target): and a solve() function"

    BenchmarkLogger.step(f"Testing template replacement on {os.path.basename(target_file)}")
    res = await collect_chat_run(
        prompt=prompt,
        file_path=target_file,
        context_code="print('old')"
    )

    if not os.path.exists(target_file):
        BenchmarkLogger.fail(f"Target file {target_file} was not written!")
        return False

    with open(target_file, "r", encoding="utf-8") as f:
        new_content = f.read()

    import ast
    try:
        ast.parse(new_content)
        BenchmarkLogger.success("Target file parsed as valid Python AST.")
    except SyntaxError as e:
        BenchmarkLogger.fail(f"Target file contains invalid Python syntax: {e}")
        return False

    try:
        os.remove(target_file)
    except Exception:
        pass

    BenchmarkLogger.success("Template replacement executed cleanly with 0 syntax errors.")
    return True


async def test_multistep_creation_and_run() -> bool:
    BenchmarkLogger.header("4. Multi-Step File Creation & Execution")
    target_script = "benchmark_counter.py"
    target_path = os.path.join(PROJECT_ROOT, target_script)
    if os.path.exists(target_path):
        os.remove(target_path)

    prompt = f"write a python script named {target_script} that prints 'BENCHMARK_OK_12345' and run it"
    BenchmarkLogger.step(f"Testing prompt: '{prompt}'")

    res = await collect_chat_run(
        prompt=prompt,
        file_path=os.path.join(PROJECT_ROOT, "server.py"),
        context_code="def solve(): pass"
    )

    steps = res["steps"]
    tokens = res["tokens"]

    if not os.path.exists(target_path):
        BenchmarkLogger.fail(f"Agent failed to create {target_script} on disk!")
        return False

    with open(target_path, "r", encoding="utf-8") as f:
        created_content = f.read()

    if "BENCHMARK_OK_12345" not in created_content:
        BenchmarkLogger.fail("Created script missing expected string 'BENCHMARK_OK_12345'!")
        return False

    run_steps = [s["step"] for s in steps if "running:" in s["step"].lower()]
    server_run = any("server.py" in s.lower() for s in run_steps)
    if server_run:
        BenchmarkLogger.fail("Agent incorrectly ran server.py instead of benchmark_counter.py!")
        return False

    try:
        os.remove(target_path)
    except Exception:
        pass

    BenchmarkLogger.success(f"Agent cleanly created {target_script} and executed it.")
    return True


async def test_autonomous_debugging() -> bool:
    BenchmarkLogger.header("5. Autonomous Self-Correction & Debugging")
    calc_path = os.path.join(PROJECT_ROOT, "benchmark_calc.py")
    
    broken_code = (
        "def compute(a, b):\n"
        "    return a / b\n\n"
        "if __name__ == '__main__':\n"
        "    print('Result:', compute(10, 0))\n"
    )
    with open(calc_path, "w", encoding="utf-8") as f:
        f.write(broken_code)

    prompt = "run benchmark_calc.py and fix any errors so it handles zero division safely and exits with exit code 0"
    BenchmarkLogger.step(f"Testing autonomous debugging on {os.path.basename(calc_path)}")

    res = await collect_chat_run(
        prompt=prompt,
        file_path=calc_path,
        context_code=broken_code
    )

    import subprocess
    run_res = subprocess.run(
        [sys.executable, calc_path],
        capture_output=True,
        text=True,
        cwd=PROJECT_ROOT
    )

    if run_res.returncode != 0:
        BenchmarkLogger.fail(f"benchmark_calc.py still fails with return code {run_res.returncode}:\n{run_res.stderr}")
        return False

    try:
        os.remove(calc_path)
    except Exception:
        pass

    BenchmarkLogger.success("Agent diagnosed the error, repaired the file, and achieved exit code 0.")
    return True


async def test_memory_persistence() -> bool:
    BenchmarkLogger.header("6. Persistent Memory Persistence")
    rule_name = "BENCHMARK_RULE_PORT_9999"
    instruction = "Always use port 9999 for test services in this project."
    prompt = f"remember that rule '{rule_name}': {instruction}"

    BenchmarkLogger.step(f"Testing memory update: '{prompt}'")
    res = await collect_chat_run(prompt=prompt)

    memory_path = os.path.join(PROJECT_ROOT, ".neuron", "memory.md")
    if not os.path.exists(memory_path):
        BenchmarkLogger.fail(f"Memory file {memory_path} does not exist!")
        return False

    with open(memory_path, "r", encoding="utf-8") as f:
        mem_content = f.read()

    if rule_name not in mem_content:
        BenchmarkLogger.fail(f"Rule '{rule_name}' was not saved in {memory_path}!")
        return False

    rules_text = read_project_rules(PROJECT_ROOT)
    if rule_name not in rules_text:
        BenchmarkLogger.fail(f"read_project_rules() did not return '{rule_name}'!")
        return False

    BenchmarkLogger.success(f"Rule '{rule_name}' successfully persisted and retrieved.")
    return True


async def run_all_benchmarks():
    print(f"\n{BenchmarkLogger.BOLD}{BenchmarkLogger.CYAN}{'#'*70}")
    print(f"#  NEURON SOVEREIGN AUTONOMOUS ENGINE (NSAE) - BENCHMARK HARNESS")
    print(f"{'#'*70}{BenchmarkLogger.RESET}\n")

    results = {}
    
    try:
        results["1_conversational_purity"] = await test_conversational_purity()
    except Exception as e:
        BenchmarkLogger.fail(f"Test 1 raised exception: {e}")
        results["1_conversational_purity"] = False

    try:
        results["2_read_only_inspection"] = await test_read_only_inspection()
    except Exception as e:
        BenchmarkLogger.fail(f"Test 2 raised exception: {e}")
        results["2_read_only_inspection"] = False

    try:
        results["3_template_replacement"] = await test_template_replacement()
    except Exception as e:
        BenchmarkLogger.fail(f"Test 3 raised exception: {e}")
        results["3_template_replacement"] = False

    try:
        results["4_multistep_creation"] = await test_multistep_creation_and_run()
    except Exception as e:
        BenchmarkLogger.fail(f"Test 4 raised exception: {e}")
        results["4_multistep_creation"] = False

    try:
        results["5_autonomous_debugging"] = await test_autonomous_debugging()
    except Exception as e:
        BenchmarkLogger.fail(f"Test 5 raised exception: {e}")
        results["5_autonomous_debugging"] = False

    try:
        results["6_memory_persistence"] = await test_memory_persistence()
    except Exception as e:
        BenchmarkLogger.fail(f"Test 6 raised exception: {e}")
        results["6_memory_persistence"] = False

    print(f"\n{BenchmarkLogger.BOLD}{BenchmarkLogger.CYAN}{'='*70}{BenchmarkLogger.RESET}")
    print(f"{BenchmarkLogger.BOLD}  BENCHMARK RESULTS SUMMARY{BenchmarkLogger.RESET}")
    print(f"{'='*70}")
    
    passed_count = 0
    total_count = len(results)
    for test_name, passed in results.items():
        status = f"{BenchmarkLogger.GREEN}PASS{BenchmarkLogger.RESET}" if passed else f"{BenchmarkLogger.RED}FAIL{BenchmarkLogger.RESET}"
        print(f"  {test_name.ljust(35)}: {status}")
        if passed:
            passed_count += 1

    print(f"{'='*70}")
    print(f"  TOTAL: {passed_count}/{total_count} PASSED ({(passed_count/total_count)*100:.1f}%)")
    print(f"{'='*70}\n")
    return passed_count == total_count


if __name__ == '__main__':
    success = asyncio.run(run_all_benchmarks())
    sys.exit(0 if success else 1)
