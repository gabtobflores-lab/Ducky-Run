"""Turn the static export in out/ into a claude.ai Artifact bundle (relative asset paths, no outer <html> skeleton)."""
import os, re, shutil, sys
src, dst = "out", sys.argv[1] if len(sys.argv) > 1 else "artifact"
shutil.rmtree(dst, ignore_errors=True)
shutil.copytree(os.path.join(src, "_next"), os.path.join(dst, "assets"))  # host reserves names starting with "_"
for root, _, files in os.walk(dst):
    for f in files:
        p = os.path.join(root, f)
        if f.endswith(".css"):
            s = open(p).read().replace("url(/_next/static/media/", "url(../media/")
            open(p, "w").write(s)
        elif f.endswith(".js"):
            s = open(p).read().replace('"/_next/"', '"./assets/"').replace("\ufffd", "\\ufffd")
            open(p, "w").write(s)
html = open(os.path.join(src, "index.html")).read().replace('"/_next/', '"./assets/').replace("/_next/", "./assets/")
head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
body = re.search(r"<body[^>]*>(.*)</body>", html, re.S).group(1)
html_cls = re.search(r'<html[^>]*class="([^"]*)"', html).group(1)
body_cls = re.search(r'<body[^>]*class="([^"]*)"', html).group(1)
head = re.sub(r'<meta charSet="utf-8"/>|<meta name="viewport"[^>]*/>', "", head)
title = re.search(r"<title>.*?</title>", head).group(0)
head = head.replace(title, "")
page = f'{title}\n<style>:root{{color-scheme:light}}</style>\n{head}\n<script>document.documentElement.className="{html_cls}";document.documentElement.lang="en";document.body.className="{body_cls}";</script>\n{body}\n'
open(os.path.join(dst, "flow.html"), "w").write(page)
print(dst, sum(len(f) for _, _, f in os.walk(dst)), "files")
