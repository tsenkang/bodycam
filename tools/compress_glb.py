#!/usr/bin/env python3
"""Reduz o tamanho de um .glb: reescala as texturas (máx. N px) e grava
como JPEG quando não há transparência. Uso:
    python3 tools/compress_glb.py entrada.glb saida.glb [max_px]
Requer Pillow (pip install pillow)."""
import io, json, struct, sys
from PIL import Image

def main(src, dst, max_px=1024):
    data = open(src, "rb").read()
    magic, version, _ = struct.unpack("<4sII", data[:12])
    assert magic == b"glTF"
    off = 12
    js, binchunk = None, b""
    while off < len(data):
        clen, ctype = struct.unpack("<II", data[off:off + 8])
        chunk = data[off + 8:off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(chunk)
        elif ctype == 0x004E4942:
            binchunk = chunk
        off += 8 + clen
    views = js["bufferViews"]
    image_views = {}
    for img in js.get("images", []):
        if "bufferView" not in img:
            continue
        bv = views[img["bufferView"]]
        raw = binchunk[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]]
        im = Image.open(io.BytesIO(raw))
        im.load()
        has_alpha = im.mode in ("RGBA", "LA", "P") and im.convert("RGBA").getextrema()[3][0] < 250
        scale = min(1.0, max_px / max(im.size))
        if scale < 1.0:
            im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.LANCZOS)
        out = io.BytesIO()
        if has_alpha:
            im.convert("RGBA").save(out, "PNG", optimize=True)
            img["mimeType"] = "image/png"
        else:
            im.convert("RGB").save(out, "JPEG", quality=85, optimize=True)
            img["mimeType"] = "image/jpeg"
        image_views[img["bufferView"]] = out.getvalue()
    # Reconstrói o buffer binário com os novos dados das imagens.
    new_bin = bytearray()
    for i, bv in enumerate(views):
        if i in image_views:
            chunk = image_views[i]
        else:
            chunk = binchunk[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]]
        while len(new_bin) % 4:
            new_bin.append(0)
        bv["byteOffset"] = len(new_bin)
        bv["byteLength"] = len(chunk)
        new_bin += chunk
    while len(new_bin) % 4:
        new_bin.append(0)
    js["buffers"][0]["byteLength"] = len(new_bin)
    jbytes = json.dumps(js, separators=(",", ":")).encode()
    while len(jbytes) % 4:
        jbytes += b" "
    total = 12 + 8 + len(jbytes) + 8 + len(new_bin)
    with open(dst, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<II", len(jbytes), 0x4E4F534A) + jbytes)
        f.write(struct.pack("<II", len(new_bin), 0x004E4942) + bytes(new_bin))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 1024)
