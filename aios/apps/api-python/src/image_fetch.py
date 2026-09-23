"""Fetches an image referenced by URL: an http(s) URL (in practice a pre-signed
storage URL) or a data: URL.

Shared by the Gemini adapter (which must send image bytes inline) and the
checked-copy PDF renderer. Errors never include the URL: a pre-signed URL's
signature is a secret, and these messages end up in logs and job failure
reports.
"""

import base64
import mimetypes
from urllib.parse import urlparse

import httpx

FETCH_TIMEOUT_SECONDS = 30
IMAGE_FETCH_TIMEOUT_SECONDS = FETCH_TIMEOUT_SECONDS  # kept for callers importing the old name
MAX_IMAGE_BYTES = 15 * 1024 * 1024


class ImageFetchError(Exception):
    pass


async def _fetch(url: str, max_bytes: int) -> tuple[bytes, str | None]:
    """(bytes, declared mime type or None). Errors never carry the URL."""
    if url.startswith("data:"):
        try:
            header, _, payload = url.partition(",")
            mime = header[len("data:"):].split(";")[0] or None
            return (base64.b64decode(payload) if ";base64" in header else payload.encode()), mime
        except Exception as e:
            raise ImageFetchError("Malformed data: URL.") from e

    if urlparse(url).scheme not in ("http", "https"):
        raise ImageFetchError("URL must be http(s) or a data: URL.")

    try:
        async with httpx.AsyncClient(timeout=FETCH_TIMEOUT_SECONDS, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except httpx.HTTPError as e:
        raise ImageFetchError(f"Could not fetch the file ({type(e).__name__}).") from None
    if len(resp.content) > max_bytes:
        raise ImageFetchError("File is too large.")
    return resp.content, (resp.headers.get("content-type", "").split(";")[0].strip() or None)


async def fetch_bytes(url: str, max_bytes: int = MAX_IMAGE_BYTES) -> bytes:
    """Raw bytes of a data: or http(s) URL, size-capped."""
    data, _mime = await _fetch(url, max_bytes)
    return data


async def fetch_image_bytes(image_url: str) -> tuple[bytes, str]:
    """Returns (bytes, mime_type). The server's declared type wins; a signed
    storage URL usually has no file extension to guess from."""
    data, mime = await _fetch(image_url, MAX_IMAGE_BYTES)
    if not mime or not mime.startswith("image/"):
        mime = mimetypes.guess_type(urlparse(image_url).path)[0] or "image/jpeg"
    if not mime.startswith("image/"):
        mime = "image/jpeg"
    return data, mime
