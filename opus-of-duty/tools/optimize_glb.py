#!/usr/bin/env python3
"""
Shrink a GLB's textures for the browser without touching geometry or rig.

Each embedded image is re-encoded as WebP, capped at a size that depends on
how the material uses it (colour and normal maps keep more detail than
roughness/AO), then the binary chunk is repacked. GLTFLoader decodes WebP
images by mimeType, and every browser that runs this game supports WebP.

    python3 tools/optimize_glb.py in.glb out.glb [--color 1024 --normal 1024 --data 512]
"""
import argparse, io, json, struct
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--color', type=int, default=1024)
ap.add_argument('--normal', type=int, default=1024)
ap.add_argument('--data', type=int, default=512)
ap.add_argument('--strip', action='store_true', help='drop animations and UV sets no material samples')
a = ap.parse_args()

raw = open(a.src, 'rb').read()
assert raw[:4] == b'glTF'
jlen = struct.unpack_from('<I', raw, 12)[0]
gltf = json.loads(raw[20:20 + jlen])
boff = 20 + jlen
blen = struct.unpack_from('<I', raw, boff)[0]
bin_ = raw[boff + 8: boff + 8 + blen]

# role of each image: the most detail-hungry slot that references it
role = {}
def mark(tex, r):
    if tex is None: return
    src = gltf['textures'][tex['index']]['source']
    order = {'data': 0, 'normal': 1, 'color': 2}
    if order[r] > order.get(role.get(src, 'data'), -1) or src not in role: role[src] = r
for m in gltf.get('materials', []):
    p = m.get('pbrMetallicRoughness', {})
    mark(p.get('baseColorTexture'), 'color')
    mark(p.get('metallicRoughnessTexture'), 'data')
    mark(m.get('normalTexture'), 'normal')
    mark(m.get('occlusionTexture'), 'data')
    mark(m.get('emissiveTexture'), 'color')

if a.strip:
    for m in gltf['meshes']:
        for p in m['primitives']:
            # UV sets this primitive's material never samples. (Vertex data in
            # Sketchfab exports is usually interleaved, so this saves little;
            # the animation data is the real win.)
            mat = gltf['materials'][p['material']] if 'material' in p else {}
            sets = {int(x) for x in __import__('re').findall(r'"texCoord":\s*(\d+)', json.dumps(mat))} | {0}
            for k in [k for k in p['attributes'] if k.startswith('TEXCOORD_') and int(k[9:]) not in sets]:
                del p['attributes'][k]
    gltf.pop('animations', None)

views = gltf['bufferViews']
new_view_data = {}
before = after = 0
for i, img in enumerate(gltf.get('images', [])):
    v = views[img['bufferView']]
    data = bin_[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]
    im = Image.open(io.BytesIO(data))
    im = im.convert('RGB')
    cap = {'color': a.color, 'normal': a.normal, 'data': a.data}[role.get(i, 'color')]
    if max(im.size) > cap:
        s = cap / max(im.size)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    out = io.BytesIO()
    q = 90 if role.get(i) == 'normal' else 82
    im.save(out, 'WEBP', quality=q, method=6)
    new_view_data[img['bufferView']] = out.getvalue()
    img['mimeType'] = 'image/webp'
    before += len(data); after += len(out.getvalue())

# keep only accessors/bufferViews still referenced, then repack 4-byte aligned
used_acc = set()
for m in gltf['meshes']:
    for p in m['primitives']:
        used_acc.update(p['attributes'].values())
        if 'indices' in p: used_acc.add(p['indices'])
        for t in p.get('targets', []): used_acc.update(t.values())
for sk in gltf.get('skins', []):
    if 'inverseBindMatrices' in sk: used_acc.add(sk['inverseBindMatrices'])
for an in gltf.get('animations', []):
    for smp in an['samplers']: used_acc.update([smp['input'], smp['output']])
acc_map = {}
new_acc = []
for i, acc in enumerate(gltf['accessors']):
    if i in used_acc:
        acc_map[i] = len(new_acc); new_acc.append(acc)
gltf['accessors'] = new_acc
for m in gltf['meshes']:
    for p in m['primitives']:
        p['attributes'] = {k: acc_map[v] for k, v in p['attributes'].items()}
        if 'indices' in p: p['indices'] = acc_map[p['indices']]
        if 'targets' in p: p['targets'] = [{k: acc_map[v] for k, v in t.items()} for t in p['targets']]
for sk in gltf.get('skins', []):
    if 'inverseBindMatrices' in sk: sk['inverseBindMatrices'] = acc_map[sk['inverseBindMatrices']]
for an in gltf.get('animations', []):
    for smp in an['samplers']: smp['input'] = acc_map[smp['input']]; smp['output'] = acc_map[smp['output']]
used_views = {acc['bufferView'] for acc in new_acc if 'bufferView' in acc} | {img['bufferView'] for img in gltf.get('images', [])}
view_map = {}
kept = []
for i, v in enumerate(views):
    if i in used_views:
        view_map[i] = len(kept); kept.append((i, v))
for acc in new_acc:
    if 'bufferView' in acc: acc['bufferView'] = view_map[acc['bufferView']]
for img in gltf.get('images', []): img['bufferView'] = view_map[img['bufferView']]
old_views = views
views = [v for _, v in kept]
new_view_data = {view_map[k]: d for k, d in new_view_data.items()}
bin_old = bin_
def old_bytes(vi):
    v = old_views[kept[vi][0]]
    o = v.get('byteOffset', 0)
    return bin_old[o: o + v['byteLength']]
gltf['bufferViews'] = views
blob = bytearray()
for vi, v in enumerate(views):
    data = new_view_data.get(vi)
    if data is None:
        data = old_bytes(vi)
    while len(blob) % 4: blob.append(0)
    v['byteOffset'] = len(blob)
    v['byteLength'] = len(data)
    blob += data
while len(blob) % 4: blob.append(0)
gltf['buffers'] = [{'byteLength': len(blob)}]

js = json.dumps(gltf, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
out = bytearray(b'glTF') + struct.pack('<II', 2, 12 + 8 + len(js) + 8 + len(blob))
out += struct.pack('<I', len(js)) + b'JSON' + js
out += struct.pack('<I', len(blob)) + b'BIN\x00' + blob
open(a.dst, 'wb').write(out)
print(f'images {before/1e6:.1f} MB -> {after/1e6:.1f} MB; file {len(raw)/1e6:.1f} MB -> {len(out)/1e6:.1f} MB')
