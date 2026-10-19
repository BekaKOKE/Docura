"""Generate tokens.css, tailwind.v4.css and tailwind.preset.cjs from tokens.json.

Standard library only. Run after every change to tokens.json, then the contrast check:

    python build_tokens.py
    python <replica-design>/contrast.py tokens.json
"""

import json
import pathlib

HERE = pathlib.Path(__file__).parent
T = json.loads((HERE / "tokens.json").read_text(encoding="utf-8"))

# Tailwind name -> token role. Utilities read as bg-surface, text-muted, border-input, ring-focus.
TW_COLORS = {
    "bg": "bg", "surface": "surface", "sunken": "surface-sunken",
    "line": "border", "input": "border-input",
    "fg": "text", "muted": "text-muted",
    "accent": "accent", "accent-hover": "accent-hover", "accent-pressed": "accent-pressed",
    "on-accent": "on-accent", "accent-text": "accent-text", "accent-tint": "accent-tint",
    "control-on": "control-on", "ink": "ink", "on-ink": "on-ink", "on-ink-muted": "on-ink-muted",
    "focus": "focus", "info": "info", "info-bg": "info-bg", "success": "success", "success-bg": "success-bg",
    "warning": "warning", "warning-bg": "warning-bg", "danger": "danger", "danger-bg": "danger-bg",
    "on-danger": "on-danger", "signature": "signature-ink",
}
HEADER = "/* Generated from tokens.json by build_tokens.py. Do not edit by hand. */\n"


def css_vars():
    lines = [HEADER, ":root {"]
    for k, v in T["color"].items():
        lines.append(f"  --dc-color-{k}: {v};")
    lines.append("  --dc-scrim: rgba(28, 27, 24, 0.48);")
    lines.append(f"  --dc-font-sans: {T['font']['sans']};")
    lines.append(f"  --dc-font-mono: {T['font']['mono']};")
    for k, v in T["type"].items():
        if k.startswith("_"):
            continue
        lines.append(f"  --dc-text-{k}: {v['size']}px;")
        lines.append(f"  --dc-leading-{k}: {v['line']}px;")
        lines.append(f"  --dc-weight-{k}: {v['weight']};")
    for i, v in enumerate(T["space"]):
        lines.append(f"  --dc-space-{i}: {v}px;")
    for k, v in T["radius"].items():
        lines.append(f"  --dc-radius-{k}: {v}px;")
    for k, v in T["border-width"].items():
        lines.append(f"  --dc-border-{k}: {v}px;")
    for k, v in T["shadow"].items():
        if not k.startswith("_"):
            lines.append(f"  --dc-shadow-{k}: {v};")
    for k, v in T["motion"].items():
        if not k.startswith("_"):
            lines.append(f"  --dc-motion-{k}: {v};")
    for k, v in T["size"].items():
        if not k.startswith("_"):
            lines.append(f"  --dc-size-{k}: {v}px;")
    for k, v in T["layout"].items():
        if k.startswith("_") or isinstance(v, dict):
            continue
        lines.append(f"  --dc-layout-{k}: {v}px;")
    for k, v in T["z"].items():
        lines.append(f"  --dc-z-{k}: {v};")
    lines.append("}")
    lines.append("""
/* Base rules every screen relies on. */
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--dc-color-bg);
  color: var(--dc-color-text);
  font-family: var(--dc-font-sans);
  font-size: var(--dc-text-base);
  line-height: var(--dc-leading-base);
  font-synthesis: none;
  -webkit-font-smoothing: antialiased;
}
:focus-visible { outline: var(--dc-border-focus) solid var(--dc-color-focus); outline-offset: 2px; }
.dc-num { font-variant-numeric: tabular-nums; }
/* Money and document numbers are atomic: "1 874 300 ₸" and "СЧ-2026-0014" never break across lines. */
.dc-money { font-variant-numeric: tabular-nums; white-space: nowrap; }
.dc-code { font-family: var(--dc-font-mono); font-variant-numeric: tabular-nums; letter-spacing: 0; white-space: nowrap; }
/* Russian labels: wrap whole words onto a second line, never hyphenate or truncate a button. */
.dc-label { white-space: normal; overflow-wrap: normal; hyphens: manual; text-wrap: balance; min-width: 0; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 1ms !important; transition-duration: 1ms !important; scroll-behavior: auto !important; }
}""")
    return "\n".join(lines) + "\n"


def tailwind_v4():
    lines = [HEADER, "/* Tailwind v4: import after tokens.css. */", "@theme inline {"]
    for tw, role in TW_COLORS.items():
        lines.append(f"  --color-{tw}: var(--dc-color-{role});")
    lines.append("  --font-sans: var(--dc-font-sans);")
    lines.append("  --font-mono: var(--dc-font-mono);")
    for k, v in T["radius"].items():
        lines.append(f"  --radius-{k}: var(--dc-radius-{k});")
    for k in T["shadow"]:
        if not k.startswith("_"):
            lines.append(f"  --shadow-{k}: var(--dc-shadow-{k});")
    for k in T["type"]:
        if not k.startswith("_"):
            lines.append(f"  --text-{k}: var(--dc-text-{k});")
            lines.append(f"  --text-{k}--line-height: var(--dc-leading-{k});")
    for k, v in T["layout"]["breakpoints"].items():
        lines.append(f"  --breakpoint-{k}: {v}px;")
    lines.append("}")
    return "\n".join(lines) + "\n"


def tailwind_v3():
    colors = ",\n".join(f"        '{tw}': 'var(--dc-color-{role})'" for tw, role in TW_COLORS.items())
    radius = ", ".join(f"'{k}': 'var(--dc-radius-{k})'" for k in T["radius"])
    shadow = ", ".join(f"'{k}': 'var(--dc-shadow-{k})'" for k in T["shadow"] if not k.startswith("_"))
    font_size = ",\n".join(
        f"        '{k}': ['var(--dc-text-{k})', {{ lineHeight: 'var(--dc-leading-{k})' }}]"
        for k in T["type"] if not k.startswith("_"))
    screens = ", ".join(f"'{k}': '{v}px'" for k, v in T["layout"]["breakpoints"].items())
    return f"""{HEADER.replace('/*', '//').replace(' */', '')}// Tailwind v3 preset: module.exports = {{ presets: [require('./tailwind.preset.cjs')], ... }}
module.exports = {{
  theme: {{
    screens: {{ {screens} }},
    extend: {{
      colors: {{
{colors}
      }},
      fontFamily: {{ sans: ['var(--dc-font-sans)'], mono: ['var(--dc-font-mono)'] }},
      fontSize: {{
{font_size}
      }},
      borderRadius: {{ {radius} }},
      boxShadow: {{ {shadow} }},
      minHeight: {{ touch: 'var(--dc-size-touch-min)' }},
      minWidth: {{ touch: 'var(--dc-size-touch-min)' }},
    }},
  }},
}};
"""


(HERE / "tokens.css").write_text(css_vars(), encoding="utf-8")
(HERE / "tailwind.v4.css").write_text(tailwind_v4(), encoding="utf-8")
(HERE / "tailwind.preset.cjs").write_text(tailwind_v3(), encoding="utf-8")
print("wrote tokens.css, tailwind.v4.css, tailwind.preset.cjs")
