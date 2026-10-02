"""
Terminal Snake Game in Python
Controls: WASD or Arrow Keys to move, Q to quit, R to restart after game over.
Supports both native console keyboard polling and piped stdin streaming.
"""

import os
import sys
import time
import random
import threading
import queue

# Enable ANSI escape sequences on Windows console
if sys.platform == "win32":
    os.system("")

# Try importing msvcrt for non-blocking keyboard input on Windows console
try:
    import msvcrt
    WINDOWS = True
except ImportError:
    WINDOWS = False


# Background queue and worker for non-blocking stdin input (works over pipes and inside IDE terminals)
INPUT_QUEUE = queue.Queue()


def _stdin_worker():
    """Reads characters and ANSI sequences from sys.stdin without blocking the main game loop."""
    while True:
        try:
            ch = sys.stdin.read(1)
            if not ch:
                time.sleep(0.01)
                continue

            if ch == '\x1b':
                # Check for ANSI escape sequences (Arrow keys: \x1b[A, \x1b[B, \x1b[C, \x1b[D)
                seq = ch
                try:
                    next1 = sys.stdin.read(1)
                    seq += next1
                    if next1 == '[':
                        next2 = sys.stdin.read(1)
                        seq += next2
                        if next2 == 'A':
                            INPUT_QUEUE.put('up')
                        elif next2 == 'B':
                            INPUT_QUEUE.put('down')
                        elif next2 == 'C':
                            INPUT_QUEUE.put('right')
                        elif next2 == 'D':
                            INPUT_QUEUE.put('left')
                        continue
                except Exception:
                    pass

            c = ch.lower()
            if c in ('w', 'a', 's', 'd', 'q', 'p', 'r', 'h', 'j', 'k', 'l'):
                INPUT_QUEUE.put(c)
        except Exception:
            break


# Start stdin listener as a daemon thread
_stdin_thread = threading.Thread(target=_stdin_worker, daemon=True)
_stdin_thread.start()


class SnakeGame:
    def __init__(self, width=32, height=18):
        self.width = width
        self.height = height
        self.reset()

    def reset(self):
        mid_x = self.width // 2
        mid_y = self.height // 2
        self.snake = [
            (mid_x, mid_y),
            (mid_x - 1, mid_y),
            (mid_x - 2, mid_y)
        ]
        self.direction = (1, 0)  # Moving Right initially
        self.score = 0
        self.game_over = False
        self.paused = False
        self.food = self._spawn_food()

    def _spawn_food(self):
        empty_cells = [
            (x, y)
            for x in range(self.width)
            for y in range(self.height)
            if (x, y) not in self.snake
        ]
        if not empty_cells:
            return None
        return random.choice(empty_cells)

    def process_input(self):
        inputs = []

        # 1. Native Windows Console buffer check (msvcrt)
        if WINDOWS:
            try:
                while msvcrt.kbhit():
                    ch = msvcrt.getch()
                    if ch in (b'\x00', b'\xe0'):
                        ext = msvcrt.getch()
                        if ext == b'H':
                            inputs.append('up')
                        elif ext == b'P':
                            inputs.append('down')
                        elif ext == b'K':
                            inputs.append('left')
                        elif ext == b'M':
                            inputs.append('right')
                    else:
                        try:
                            char = ch.decode("utf-8", errors="ignore").lower()
                            inputs.append(char)
                        except Exception:
                            pass
            except Exception:
                pass

        # 2. Universal piped stdin queue check
        try:
            while not INPUT_QUEUE.empty():
                item = INPUT_QUEUE.get_nowait()
                inputs.append(item)
        except Exception:
            pass

        # Apply collected inputs
        for inp in inputs:
            if inp in ('quit', 'q'):
                self.game_over = True
                return 'quit'
            elif inp == 'p':
                self.paused = not self.paused
            elif inp == 'r' and self.game_over:
                self.reset()
            elif inp in ('up', 'w', 'k') and self.direction != (0, 1):
                self.direction = (0, -1)
            elif inp in ('down', 's', 'j') and self.direction != (0, -1):
                self.direction = (0, 1)
            elif inp in ('left', 'a', 'h') and self.direction != (1, 0):
                self.direction = (-1, 0)
            elif inp in ('right', 'd', 'l') and self.direction != (-1, 0):
                self.direction = (1, 0)

        return None

    def update(self):
        if self.game_over or self.paused:
            return

        cur_head_x, cur_head_y = self.snake[0]
        dx, dy = self.direction
        new_head = (cur_head_x + dx, cur_head_y + dy)

        # Wall collision check
        new_x, new_y = new_head
        if new_x < 0 or new_x >= self.width or new_y < 0 or new_y >= self.height:
            self.game_over = True
            return

        # Self-collision check
        if new_head in self.snake:
            self.game_over = True
            return

        # Move snake
        self.snake.insert(0, new_head)

        # Food check
        if new_head == self.food:
            self.score += 10
            self.food = self._spawn_food()
        else:
            self.snake.pop()

    def render(self):
        # Build whole frame in memory to prevent screen flicker
        lines = []
        lines.append("=== TERMINAL SNAKE ===")
        lines.append(f"Score: {self.score:<6} | Length: {len(self.snake):<4} | Controls: WASD/Arrows | Q: Quit | P: Pause")
        lines.append("+" + "-" * self.width + "+")

        snake_head = self.snake[0] if self.snake else None
        snake_body = set(self.snake[1:]) if len(self.snake) > 1 else set()

        for y in range(self.height):
            row_chars = []
            for x in range(self.width):
                pos = (x, y)
                if pos == snake_head:
                    row_chars.append("O")
                elif pos in snake_body:
                    row_chars.append("o")
                elif pos == self.food:
                    row_chars.append("*")
                else:
                    row_chars.append(" ")
            lines.append("|" + "".join(row_chars) + "|")

        lines.append("+" + "-" * self.width + "+")

        if self.paused:
            lines.append(">> GAME PAUSED -- Press 'P' to resume <<")
        elif self.game_over:
            lines.append(">> GAME OVER! Press 'R' to restart, or 'Q' to quit <<")
        else:
            lines.append("Playing... Keep eating the food (*) to grow!")

        frame = "\033[H" + "\n".join(lines) + "\n"
        sys.stdout.write(frame)
        sys.stdout.flush()


def solve():
    # Clear screen once initially
    os.system("cls" if os.name == "nt" else "clear")
    # Hide cursor on terminal if supported
    sys.stdout.write("\033[?25l")
    sys.stdout.flush()

    game = SnakeGame(width=32, height=18)

    try:
        while True:
            action = game.process_input()
            if action == 'quit':
                break

            if not game.game_over and not game.paused:
                game.update()

            game.render()

            # Dynamic speed based on score: starts at 120ms, caps at 60ms
            delay = max(0.06, 0.13 - (game.score * 0.001))
            time.sleep(delay)

            if game.game_over:
                # Wait for user input when game over
                while game.game_over:
                    res = game.process_input()
                    if res == 'quit':
                        return
                    if not game.game_over:
                        break
                    game.render()
                    time.sleep(0.1)

    except KeyboardInterrupt:
        pass
    finally:
        # Restore terminal cursor visibility
        sys.stdout.write("\033[?25h\033[H\033[J")
        sys.stdout.flush()
        print("Thanks for playing Snake!")


if __name__ == '__main__':
    solve()