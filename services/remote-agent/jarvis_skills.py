"""
jarvis_skills.py  v4  —  JARVIS PC Skills
All OS actions go into ACTION_QUEUE and are executed on the main thread.
"""

import os, re, math, random, platform, datetime, subprocess, webbrowser, queue

ACTION_QUEUE = queue.Queue()

def queue_action(fn, *args, **kwargs):
    ACTION_QUEUE.put((fn, args, kwargs))

def process_action_queue():
    while not ACTION_QUEUE.empty():
        try:
            fn, args, kwargs = ACTION_QUEUE.get_nowait()
            fn(*args, **kwargs)
        except Exception as e:
            print(f"[ACTION ERROR] {e}")

# ── optional imports ────────────────────────────────────────────────────────
try:
    import pyautogui; pyautogui.FAILSAFE = False; PGUI = True
except ImportError:
    PGUI = False; print("[JARVIS] pip install pyautogui  ← for volume/screenshot")

try:
    from duckduckgo_search import DDGS; SEARCH = True
except ImportError:
    SEARCH = False; print("[JARVIS] pip install duckduckgo-search  ← for web search")

try:
    import requests; REQ = True
except ImportError:
    REQ = False; print("[JARVIS] pip install requests  ← for weather")

# ── text cleaner ─────────────────────────────────────────────────────────────
def clean(t):
    t = t.lower().strip()
    t = re.sub(r"[^\w\s]", " ", t)
    t = re.sub(r"\s+",     " ", t)
    return t.strip()

def has(cmd, *words):
    return any(w in cmd for w in words)

def after(cmd, *keys):
    for k in sorted(keys, key=len, reverse=True):
        i = cmd.find(k)
        if i != -1:
            tail = cmd[i+len(k):].strip()
            if tail: return tail
    return ""

# ── websites & apps ───────────────────────────────────────────────────────────
SITES = {
    "youtube":"https://youtube.com","google":"https://google.com",
    "github":"https://github.com","reddit":"https://reddit.com",
    "twitter":"https://twitter.com","facebook":"https://facebook.com",
    "instagram":"https://instagram.com","wikipedia":"https://wikipedia.org",
    "netflix":"https://netflix.com","amazon":"https://amazon.com",
    "gmail":"https://mail.google.com","maps":"https://maps.google.com",
    "whatsapp":"https://web.whatsapp.com","spotify":"https://open.spotify.com",
    "twitch":"https://twitch.tv","linkedin":"https://linkedin.com",
    "chatgpt":"https://chat.openai.com","discord":"https://discord.com",
}

JOKES = [
    "Why do programmers prefer dark mode? Because light attracts bugs, sir.",
    "Why do Java developers wear glasses? Because they don't C sharp.",
    "Why was the computer cold? It left its Windows open.",
    "I would tell you a joke about UDP, but you might not get it.",
    "There are only 10 kinds of people: those who understand binary, and those who don't.",
    "A SQL query walks into a bar and asks two tables: can I join you?",
]

# ── OS helpers ────────────────────────────────────────────────────────────────
def _open_url(url):
    print(f"[ACTION] opening url → {url}")
    webbrowser.open(url)

def _start_app(name):
    """Most reliable Windows app launcher — uses shell 'start' resolver."""
    print(f"[ACTION] starting app → {name}")
    try:
        # 'start "" <name>' lets Windows find the app via registry / PATH
        subprocess.Popen(f'start "" "{name}"', shell=True)
    except Exception as e:
        print(f"[ACTION ERROR] {e}")
        try:
            os.startfile(name)
        except Exception as e2:
            print(f"[ACTION ERROR fallback] {e2}")

def _press_keys(*keys):
    if PGUI: pyautogui.hotkey(*keys)

def _screenshot():
    if not PGUI: return
    path = os.path.join(os.path.expanduser("~"), "Desktop",
           f"jarvis_{datetime.datetime.now().strftime('%H%M%S')}.png")
    pyautogui.screenshot().save(path)
    print(f"[ACTION] screenshot → {path}")

# ── skills ────────────────────────────────────────────────────────────────────
def s_time():   return f"The time is {datetime.datetime.now().strftime('%I:%M %p')}, sir."
def s_date():   return f"Today is {datetime.date.today().strftime('%A %B %d %Y')}, sir."
def s_joke():   return random.choice(JOKES)

def s_weather(loc=""):
    if not REQ: return "Install requests for weather, sir."
    try:
        r = requests.get(f"https://wttr.in/{loc.strip() or 'auto'}?format=3", timeout=6)
        return r.text.strip() if r.ok else "Weather data unavailable, sir."
    except Exception as e: return f"Weather error: {e}"

def s_search(q):
    if not q:      return "What should I search for, sir?"
    if not SEARCH: return "Install duckduckgo-search for web search, sir."
    print(f"[SKILL] searching: {q}")
    try:
        with DDGS() as d:
            results = list(d.text(q, max_results=3))
        if not results: return f"Nothing found for {q}, sir."
        body = results[0].get("body", results[0].get("title",""))
        return body.split(".")[0].strip() + "."
    except Exception as e: return f"Search error: {e}"

def s_open_site(name):
    url = SITES.get(name, f"https://www.{name}.com")
    queue_action(_open_url, url)
    return f"Opening {name}, sir."

def s_open_app(name):
    queue_action(_start_app, name)
    return f"Launching {name}, sir."

def s_volume(cmd):
    if not PGUI: return "Install pyautogui for volume control, sir."
    if has(cmd, "up","louder","increase"):
        queue_action(lambda: [pyautogui.press("volumeup") for _ in range(5)])
        return "Volume up, sir."
    elif has(cmd, "down","quieter","lower","decrease"):
        queue_action(lambda: [pyautogui.press("volumedown") for _ in range(5)])
        return "Volume down, sir."
    elif has(cmd, "mute","silent"):
        queue_action(lambda: pyautogui.press("volumemute"))
        return "Muted, sir."
    return "I did not catch the volume direction, sir."

def s_screenshot():
    queue_action(_screenshot)
    return "Screenshot saved to your desktop, sir."

def s_math(expr):
    expr = (expr.replace("times","*").replace("multiplied by","*")
               .replace("divided by","/").replace("plus","+")
               .replace("minus","-").replace("squared","**2"))
    expr = re.sub(r"[^0-9\+\-\*\/\(\)\.\s]","",expr).strip()
    try:
        r = eval(expr, {"__builtins__":{},"math":math})
        return f"The answer is {int(r) if isinstance(r,float) and r.is_integer() else r}, sir."
    except: return "I could not compute that, sir."

def s_close():
    queue_action(_press_keys,"alt","f4"); return "Closing window, sir."
def s_minimize():
    queue_action(_press_keys,"win","down"); return "Minimized, sir."
def s_desktop():
    queue_action(_press_keys,"win","d"); return "Showing desktop, sir."
def s_lock():
    queue_action(lambda: subprocess.run("rundll32.exe user32.dll,LockWorkStation",shell=True))
    return "Locking PC, sir."
def s_new_tab():
    queue_action(_press_keys,"ctrl","t"); return "New tab, sir."
def s_copy():
    queue_action(_press_keys,"ctrl","c"); return "Copied, sir."
def s_paste():
    queue_action(_press_keys,"ctrl","v"); return "Pasted, sir."

# ── intent router ─────────────────────────────────────────────────────────────
def detect_and_run(raw):
    cmd = clean(raw)
    print(f"\n[INTENT] raw='{raw}'")
    print(f"[INTENT] cleaned='{cmd}'")

    if has(cmd,"what time","time is it","current time","tell me the time"):
        return "time", s_time()
    if has(cmd,"what date","what day","today's date","todays date","current date"):
        return "date", s_date()
    if has(cmd,"joke","funny","make me laugh","crack a joke"):
        return "joke", s_joke()
    if has(cmd,"volume up","turn up","louder","volume down","turn down",
              "quieter","mute","unmute","increase volume","decrease volume"):
        return "volume", s_volume(cmd)
    if has(cmd,"screenshot","capture screen","take a picture of the screen"):
        return "screenshot", s_screenshot()
    if has(cmd,"close window","close this","close the window","close app"):
        return "close", s_close()
    if has(cmd,"minimize","minimise"):
        return "minimize", s_minimize()
    if has(cmd,"show desktop","go to desktop","hide windows"):
        return "desktop", s_desktop()
    if has(cmd,"lock the pc","lock my pc","lock screen","lock computer"):
        return "lock", s_lock()
    if has(cmd,"new tab","open new tab","open a new tab"):
        return "new_tab", s_new_tab()
    if has(cmd,"copy that","copy this"):
        return "copy", s_copy()
    if has(cmd,"paste that","paste this"):
        return "paste", s_paste()
    if has(cmd,"weather","temperature","forecast","how hot","how cold","will it rain"):
        loc = after(cmd,"weather in","weather for","temperature in",
                       "forecast for","weather at","weather")
        return "weather", s_weather(loc)

    # open website — check before open_app
    if has(cmd,"open","go to","browse","navigate to","launch"):
        for site in SITES:
            if site in cmd:
                print(f"[INTENT] → open_website ({site})")
                return "open_website", s_open_site(site)

    # search
    if has(cmd,"search for","search","look up","find information",
              "tell me about","who is","what is","find out"):
        q = after(cmd,"search for","look up","find information about",
                     "tell me about","who is","what is","find out about","search")
        if q and len(q) > 2:
            print(f"[INTENT] → search ('{q}')")
            return "search", s_search(q)

    # open app — after website check
    if has(cmd,"open ","launch ","start ","run "):
        app = after(cmd,"open","launch","start","run")
        if app and len(app) > 1 and not any(s in app for s in SITES):
            print(f"[INTENT] → open_app ('{app}')")
            return "open_app", s_open_app(app)

    # math
    if any(c.isdigit() for c in cmd) and has(cmd,"calculate","compute",
           "what is","how much","times","divided","plus","minus","squared"):
        expr = after(cmd,"calculate","compute","what is","how much is") or cmd
        return "math", s_math(expr)

    if has(cmd,"goodbye","bye","exit jarvis","stop jarvis","shut down jarvis"):
        return "stop", "Goodbye, sir."

    print("[INTENT] → chat (no skill matched)")
    return "chat", None
