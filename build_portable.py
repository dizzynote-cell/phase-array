"""Rebuild the offline, single-file edition from the editor sources."""
from pathlib import Path
import re

root = Path(__file__).resolve().parent
def read(name):
    return (root / name).read_text(encoding="utf-8-sig")

html = read("index.html").replace('<link rel="stylesheet" href="studio.css">', '<style>' + read("studio.css") + '</style>')
def inline(match):
    code = read(match[1])
    code = re.sub(r"(?im)^//# sourceMappingURL=.*$", "", code)
    return "<script>" + re.sub(r"</script", lambda _: r"<\/script", code, flags=re.I) + "\n</script>"

html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
notices = read("LICENSE") + "\n" + "\n".join(read("vendor/" + name) for name in ("LICENSE.md", "Tone.js.LICENSE.txt", "ThirdPartyNotices.txt"))
from html import escape
html = html.replace("</html>", "<template id='third-party-notices'><pre>" + escape(notices) + "</pre></template></html>")
(root / "PHASE ARRAY（相位阵列）音频视觉工具.html").write_text(html, encoding="utf-8")
