"""Office documents, HTML and web pages → PDF/image, through Gotenberg (LibreOffice + Chromium)."""

import ipaddress
import re
import socket
from pathlib import Path
from urllib.parse import urlsplit

from .. import gotenberg
from ..errors import ToolError
from ..registry import Job, Opt, ServerTool, register

LIBREOFFICE = "/forms/libreoffice/convert"
PAPER = {"a4": ("8.27", "11.7"), "letter": ("8.5", "11")}


async def libreoffice(job: Job) -> Path:
    data = {}
    if job.options.get("landscape"):
        data["landscape"] = "true"
    if job.options.get("one_page"):
        data["singlePageSheets"] = "true"
    if job.options.get("pdfa"):
        data["pdfa"] = "PDF/A-2b"
    return await gotenberg.convert(LIBREOFFICE, job.out("pdf"), job.timeout, [(f"document.{job.ext}", job.src)], data)


def _page(job: Job) -> dict[str, str]:
    w, h = PAPER[job.options.get("paper", "a4")]
    return {
        "paperWidth": w,
        "paperHeight": h,
        "landscape": "true" if job.options.get("landscape") else "false",
        "printBackground": "true" if job.options.get("background", True) else "false",
        # A page's own @page size (e.g. our Markdown templates) wins over the paper option.
        "preferCssPageSize": "true",
    }


async def html_to_pdf(job: Job) -> Path:
    files = [("index.html", job.src)] + [(p.name, p) for p in job.assets]
    data = _page(job) | {
        # Documents laid out by Paged.js say when they are ready; others print right away.
        "waitForExpression": "!window.PagedConfig || document.documentElement.dataset.paged === 'done'",
        "marginTop": "0",
        "marginBottom": "0",
        "marginLeft": "0",
        "marginRight": "0",
    }
    return await gotenberg.convert("/forms/chromium/convert/html", job.out("pdf"), job.timeout, files, data)


URL_RE = re.compile(r"^https?://[^\s/?#@]+(?:[/?#][^\s]*)?$", re.I)


def check_url(url: str | None) -> str:
    """Public http(s) pages only.

    First line of defence against SSRF: no private IP literals, no single-label or internal names
    (our containers are `api`, `gotenberg`, `caddy`). Gotenberg runs with --chromium-deny-private-ips,
    which checks what every request (redirects and sub-resources too) resolves to.
    """
    url = (url or "").strip()
    if len(url) > 2000 or not URL_RE.match(url):
        raise ToolError("bad-options", "bad url")
    host = (urlsplit(url).hostname or "").rstrip(".").lower()
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        ip = None
    if ip is None and re.fullmatch(r"[0-9a-fx.]+", host):
        # Browsers also read odd IPv4 forms: 0x7f.1, 017700000001, 2130706433 all mean 127.0.0.1.
        try:
            ip = ipaddress.IPv4Address(socket.inet_aton(host))
        except OSError:
            pass
    if ip is not None:
        if not ip.is_global:
            raise ToolError("bad-options", "private address")
    elif "." not in host or host == "localhost" or host.endswith((".localhost", ".local", ".internal", ".lan", ".home.arpa")):
        raise ToolError("bad-options", "private address")
    return url


async def url_to_pdf(job: Job) -> Path:
    data = _page(job) | {"url": check_url(job.url), "emulatedMediaType": job.options["media"], "waitDelay": "1s"}
    return await gotenberg.convert("/forms/chromium/convert/url", job.out("pdf"), job.timeout, data=data)


DEVICES = {"desktop": (1366, 768), "tablet": (820, 1180), "phone": (390, 844)}


async def url_to_image(job: Job) -> Path:
    w, h = DEVICES[job.options["device"]]
    fmt = job.options["format"]
    data = {
        "url": check_url(job.url),
        "width": str(w),
        "height": str(h),
        "clip": "false" if job.options["full_page"] else "true",
        "format": "jpeg" if fmt == "jpg" else fmt,
        "waitDelay": "1s",
    }
    if fmt != "png":
        data["quality"] = "85"
    return await gotenberg.convert("/forms/chromium/screenshot/url", job.out(fmt), job.timeout, data=data)


async def pdf_to_pdfa(job: Job) -> Path:
    data = {"pdfa": job.options["level"]}
    return await gotenberg.convert("/forms/pdfengines/convert", job.out("pdf"), job.timeout, [("document.pdf", job.src)], data)


G = ("gotenberg",)
landscape = Opt("bool", False)
pdfa = Opt("bool", False)
paper = Opt("choice", "a4", ("a4", "letter"))

register(ServerTool("word-to-pdf", frozenset({"doc", "docx", "odt", "rtf"}), libreoffice, G, {"pdfa": pdfa}))
register(ServerTool("excel-to-pdf", frozenset({"xls", "xlsx", "ods"}), libreoffice, G,
                    {"landscape": landscape, "one_page": Opt("bool", False), "pdfa": pdfa}))
register(ServerTool("powerpoint-to-pdf", frozenset({"ppt", "pptx", "pps", "ppsx", "odp"}), libreoffice, G, {"pdfa": pdfa}))
register(ServerTool("html-to-pdf", frozenset({"html", "htm"}), html_to_pdf, G,
                    {"paper": paper, "landscape": landscape, "background": Opt("bool", True)}, assets=True))
register(ServerTool("url-to-pdf", frozenset(), url_to_pdf, G,
                    {"paper": paper, "landscape": landscape, "background": Opt("bool", True),
                     "media": Opt("choice", "print", ("print", "screen"))}, timeout=90))
register(ServerTool("url-to-image", frozenset(), url_to_image, G,
                    {"device": Opt("choice", "desktop", tuple(DEVICES)), "full_page": Opt("bool", True),
                     "format": Opt("choice", "png", ("png", "jpg", "webp"))}, timeout=90))
register(ServerTool("pdf-to-pdfa", frozenset({"pdf"}), pdf_to_pdfa, G,
                    {"level": Opt("choice", "PDF/A-2b", ("PDF/A-1b", "PDF/A-2b", "PDF/A-3b"))}))
