"""Audio and video with FFmpeg: big files and the formats a browser can't open (AVI, WMV, FLV, 3GP, AMR...)."""

from pathlib import Path

from ..errors import ToolError
from ..jobs import run
from ..registry import Job, Opt, ServerTool, register

VIDEO_IN = {"mp4", "m4v", "mov", "webm", "mkv", "avi", "wmv", "asf", "flv", "3gp", "3g2", "mpg", "mpeg",
            "ts", "mts", "m2ts", "vob", "ogv"}  # fmt: skip
AUDIO_IN = {"mp3", "wav", "ogg", "oga", "opus", "m4a", "aac", "flac", "amr", "wma", "aif", "aiff", "ac3", "caf", "mka"}
VIDEO_OUT = ("mp4", "webm")
AUDIO_OUT = ("mp3", "m4a", "wav", "ogg")

# Only real media containers: no playlists (hls, concat, ...), which could make FFmpeg read other
# files on the server or fetch URLs.
DEMUXERS = ("mov,mp4,m4a,3gp,3g2,mj2,matroska,webm,avi,asf,flv,mpeg,mpegts,mpegvideo,ogg,mp3,wav,aac,flac,"
            "amr,amrnb,amrwb,aiff,ac3,caf,h264,hevc,m4v,dv,vob")  # fmt: skip

CRF = {"mp4": {"high": 20, "medium": 24, "low": 28, "very-low": 32},
       "webm": {"high": 30, "medium": 35, "low": 40, "very-low": 45}}  # fmt: skip


def scale(height: int) -> list[str]:
    """Limits the short side (so portrait phone videos shrink like landscape ones), even sizes."""
    if not height:
        return ["-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2"]
    w = f"if(gt(iw\\,ih)\\,-2\\,trunc(min(iw\\,{height})/2)*2)"
    h = f"if(gt(iw\\,ih)\\,trunc(min(ih\\,{height})/2)*2\\,-2)"
    return ["-vf", f"scale='{w}':'{h}'"]


async def media(job: Job) -> Path:
    o = job.options
    to = o["to"]
    if to in VIDEO_OUT and job.ext not in VIDEO_IN:
        raise ToolError("bad-options", "audio file to a video format")
    out = job.out(to)
    args = ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
            "-format_whitelist", DEMUXERS, "-protocol_whitelist", "file", "-i", f"file:{job.src.name}"]  # fmt: skip
    kbps = f"{o['kbps']}k"
    if to == "mp4":
        args += ["-map", "0:v:0", "-map", "0:a:0?", *scale(o["height"]),
                 "-c:v", "libx264", "-preset", "veryfast", "-crf", str(CRF["mp4"][o["quality"]]), "-pix_fmt", "yuv420p",
                 "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart"]  # fmt: skip
    elif to == "webm":
        args += ["-map", "0:v:0", "-map", "0:a:0?", *scale(o["height"]),
                 "-c:v", "libvpx-vp9", "-crf", str(CRF["webm"][o["quality"]]), "-b:v", "0", "-row-mt", "1",
                 "-deadline", "good", "-cpu-used", "4", "-c:a", "libopus", "-b:a", "96k"]  # fmt: skip
    elif to == "mp3":
        args += ["-map", "0:a:0", "-vn", "-c:a", "libmp3lame", "-b:a", kbps]
    elif to == "m4a":
        args += ["-map", "0:a:0", "-vn", "-c:a", "aac", "-b:a", kbps, "-movflags", "+faststart"]
    elif to == "wav":
        args += ["-map", "0:a:0", "-vn", "-c:a", "pcm_s16le"]
    else:  # ogg
        args += ["-map", "0:a:0", "-vn", "-c:a", "libopus", "-b:a", kbps]
    if o["mute"] and to in VIDEO_OUT:
        args += ["-an"]
    args += ["-map_metadata", "-1", f"file:{out.name}"]
    code, err = await run(args, job.dir, job.timeout)
    if code != 0 or not out.exists() or out.stat().st_size == 0:
        if "matches no streams" in err or "does not contain any stream" in err:
            raise ToolError("nothing", "no such stream")
        raise ToolError("corrupted")
    return out


register(ServerTool("media-convert", frozenset(VIDEO_IN | AUDIO_IN), media, ("ffmpeg",), {
    "to": Opt("choice", "mp4", VIDEO_OUT + AUDIO_OUT),
    "quality": Opt("choice", "medium", ("high", "medium", "low", "very-low")),
    "height": Opt("int", 0, min=0, max=2160),
    "kbps": Opt("choice", "128", ("64", "96", "128", "192", "320")),
    "mute": Opt("bool", False),
}, timeout=900))
