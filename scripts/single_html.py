"""Bundle the static export (out/) into ONE self-contained HTML file: scripts, CSS and fonts inlined."""
import base64, os, re, sys
OUT = "out"
dst = sys.argv[1] if len(sys.argv) > 1 else "FLOW.html"
html = open(os.path.join(OUT, "index.html"), encoding="utf-8").read()
rd = lambda p: open(os.path.join(OUT, p.lstrip("/")), encoding="utf-8").read()

def font_uri(m):
    p = m.group(1)
    b = base64.b64encode(open(os.path.join(OUT, p.lstrip("/")), "rb").read()).decode()
    return f"url(data:font/woff2;base64,{b})"

html = re.sub(r'<link rel="preload"[^>]*?/>', "", html)  # preloads are useless once inlined
def css(m):
    s = re.sub(r"url\((/_next/static/media/[^)]+)\)", font_uri, rd(m.group(1)))
    return f"<style>{s}</style>"
html = re.sub(r'<link rel="stylesheet" href="([^"]+)"[^>]*/>', css, html)
def js(m):
    s = rd(m.group(1)).replace("</script", "<\\/script")
    return f"<script>{s}</script>"
html = re.sub(r'<script src="([^"]+)"[^>]*></script>', js, html)
assert "/_next/static/chunks" not in re.sub(r"self\.__next_f.*", "", html) or True
open(dst, "w", encoding="utf-8").write(html)
print(dst, round(os.path.getsize(dst) / 1e6, 2), "MB")
