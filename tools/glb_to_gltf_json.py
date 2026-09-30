#!/usr/bin/env python3
"""Converte .glb em glTF JSON com o buffer embutido (base64). Útil para
hospedagens que só servem .json. Uso: python3 tools/glb_to_gltf_json.py in.glb out.json"""
import base64, json, struct, sys

def main(src, dst):
    data = open(src, "rb").read()
    off, js, binchunk = 12, None, b""
    while off < len(data):
        clen, ctype = struct.unpack("<II", data[off:off + 8])
        chunk = data[off + 8:off + 8 + clen]
        if ctype == 0x4E4F534A: js = json.loads(chunk)
        elif ctype == 0x004E4942: binchunk = chunk
        off += 8 + clen
    js["buffers"][0]["uri"] = "data:application/octet-stream;base64," + base64.b64encode(binchunk).decode()
    js["buffers"][0]["byteLength"] = len(binchunk)
    with open(dst, "w") as f:
        json.dump(js, f, separators=(",", ":"))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
