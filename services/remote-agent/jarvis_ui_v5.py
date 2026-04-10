"""
jarvis_ui.py  v5
Tkinter JARVIS UI  +  WebSocket bridge (ws://localhost:8765) for React CommandPilot.

Changes from v4:
  - Imports and starts jarvis_bridge in a daemon thread on startup.
  - _apply_status() now broadcasts status changes to all connected React clients
    so the CommandPilot Jarvis screen stays in sync with the voice loop.
  - Added _send_to_react() helper.
"""

import tkinter as tk
from tkinter import Canvas
import math, random, threading, sys, os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jarvis_core import JarvisCore
from jarvis_bridge import start_bridge_thread, broadcast   # ← NEW

VERSION = "v5"


class JarvisUI:
    def __init__(self, master):
        self.master   = master
        self.angle    = 0
        self.pulse    = 0
        self.status   = "STANDBY"
        self.waveform = [0] * 50

        self.master.title("J.A.R.V.I.S.  ×  CommandPilot")
        self.master.configure(bg='#000510')

        sw = self.master.winfo_screenwidth()
        sh = self.master.winfo_screenheight()
        self.master.geometry(f"800x600+{(sw-800)//2}+{(sh-600)//2}")

        self.colors = {
            'primary':   '#00D4FF',
            'secondary': '#0080FF',
            'glow':      '#66E5FF',
            'dark':      '#001122',
            'bg':        '#000510',
            'red':       '#FF3333',
            'green':     '#33FF33',
        }

        self._build_canvas()
        self._animate()

        self.master.bind('<Escape>', lambda e: self._shutdown())
        self.master.protocol("WM_DELETE_WINDOW", self._shutdown)

        # ── start bridge FIRST so React can connect immediately ───────────────
        print(f"[UI {VERSION}] Starting WebSocket bridge…")
        start_bridge_thread()

        # ── create Jarvis core ────────────────────────────────────────────────
        print(f"[UI {VERSION}] Creating JarvisCore…")
        self.jarvis = JarvisCore(
            ui_callback=self._set_status,
            master=self.master
        )

        print(f"[UI {VERSION}] Starting OS action queue drain…")
        self.master.after(100, self.jarvis.drain_queue)

        print(f"[UI {VERSION}] Launching voice thread…")
        t = threading.Thread(target=self.jarvis.run, daemon=True)
        t.start()
        print(f"[UI {VERSION}] Voice thread running.")

    # ── canvas setup ──────────────────────────────────────────────────────────
    def _build_canvas(self):
        self.canvas = Canvas(
            self.master, width=800, height=600,
            bg=self.colors['bg'], highlightthickness=0
        )
        self.canvas.pack(fill=tk.BOTH, expand=True)
        cx, cy = 400, 300

        self.outer_ring = self.canvas.create_oval(
            cx-250, cy-250, cx+250, cy+250,
            outline=self.colors['secondary'], width=1, dash=(5, 5))
        self.main_ring = self.canvas.create_oval(
            cx-220, cy-220, cx+220, cy+220,
            outline=self.colors['primary'], width=3)
        self.inner_ring = self.canvas.create_oval(
            cx-180, cy-180, cx+180, cy+180,
            outline=self.colors['secondary'], width=2)
        self.core_oval = self.canvas.create_oval(
            cx-130, cy-130, cx+130, cy+130,
            fill=self.colors['dark'], outline=self.colors['primary'], width=2)
        self.status_text = self.canvas.create_text(
            cx, cy-40, text="STANDBY",
            fill=self.colors['primary'], font=("Consolas", 24, "bold"))
        self.time_text = self.canvas.create_text(
            cx, cy, text="",
            fill=self.colors['glow'], font=("Consolas", 48, "bold"))
        self.resp_text = self.canvas.create_text(
            cx, cy+70, text="Say 'hello' to activate",
            fill=self.colors['secondary'], font=("Consolas", 12), width=350)

        # bridge status label (bottom-left)
        self.bridge_text = self.canvas.create_text(
            10, 10, anchor="nw",
            text="Bridge: ws://localhost:8765",
            fill="#0080FF80", font=("Consolas", 9))

        self.ticks = []
        for i in range(12):
            a = (i * 30) * math.pi / 180
            self.ticks.append(self.canvas.create_line(
                cx+190*math.cos(a), cy+190*math.sin(a),
                cx+210*math.cos(a), cy+210*math.sin(a),
                fill=self.colors['primary'], width=2))

        self.wave_lines = []
        for i in range(50):
            self.wave_lines.append(self.canvas.create_line(
                150+i*10, 520, 150+i*10, 520,
                fill=self.colors['glow'], width=2))

        self.canvas.create_text(
            400, 580,
            text="[ESC] Exit  |  Say 'hello' to wake  |  CommandPilot → ws://localhost:8765",
            fill=self.colors['secondary'], font=("Consolas", 9))

    # ── thread-safe UI + bridge update ───────────────────────────────────────
    def _set_status(self, status, text=""):
        """Called from voice thread — route to main thread via after()."""
        self.master.after(0, self._apply_status, status, text)

    def _apply_status(self, status, text=""):
        self.status = status

        c = {
            'STANDBY':   self.colors['primary'],
            'LISTENING': self.colors['red'],
            'SPEAKING':  self.colors['green'],
            'THINKING':  self.colors['glow'],
        }.get(status, self.colors['primary'])

        self.canvas.itemconfig(self.status_text, text=status, fill=c)
        self.canvas.itemconfig(self.core_oval,   outline=c)

        if text and status == "SPEAKING":
            self.canvas.itemconfig(self.resp_text, text=text)
        elif status == "STANDBY":
            self.canvas.itemconfig(self.resp_text, text="Say 'hello' to activate")

        # ── broadcast to React clients ────────────────────────────────────────
        broadcast({
            "type":   "status",
            "status": status,
            "text":   text if status == "SPEAKING" else "",
        })

    # ── animation ─────────────────────────────────────────────────────────────
    def _animate(self):
        self.angle += 1.5
        self.pulse += 0.08
        self.canvas.itemconfig(
            self.time_text,
            text=datetime.now().strftime("%H:%M:%S")
        )
        self.canvas.itemconfig(self.outer_ring, dashoffset=-self.angle)
        p = 8 * math.sin(self.pulse)
        self.canvas.coords(self.main_ring,
                           400-220-p, 300-220-p, 400+220+p, 300+220+p)
        for i, tick in enumerate(self.ticks):
            a = ((i * 30) + self.angle) * math.pi / 180
            r = 210 + 4 * math.sin(self.pulse + i * 0.5)
            self.canvas.coords(tick,
                400+190*math.cos(a), 300+190*math.sin(a),
                400+r  *math.cos(a), 300+r  *math.sin(a))
        if self.status in ("LISTENING", "SPEAKING"):
            self.waveform = [random.gauss(0, 25) for _ in range(50)]
        else:
            self.waveform = [w * 0.95 for w in self.waveform]
        for i, line in enumerate(self.wave_lines):
            x  = 150 + i * 10
            yo = self.waveform[i]
            self.canvas.coords(line, x, 520-yo, x, 520+yo)
        self.master.after(50, self._animate)

    # ── shutdown ──────────────────────────────────────────────────────────────
    def _shutdown(self):
        self.master.quit()
        self.master.destroy()


class JarvisApp:
    def __init__(self):
        self.root = tk.Tk()
        self.ui   = JarvisUI(self.root)

    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    JarvisApp().run()
