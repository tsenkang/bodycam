class_name MapMaterials
extends RefCounted
## ============================================================================
##  Materiais "realistas" gerados por código (sem assets externos):
##  asfalto, calçada, piso da praça, tijolo, reboco, concreto, metal
##  ondulado, piso cerâmico, madeira, fachada com janelas, telhado etc.
##
##  Cada material tem textura de cor + mapa de normal (relevo) e usa
##  mapeamento triplanar em coordenadas do mundo (não precisa de UV).
##  As imagens geradas ficam em cache em user://texture_cache/ para o
##  próximo carregamento ser rápido.
##
##  Para usar texturas fotográficas reais: coloque em
##  res://assets/textures/<nome>_albedo.png e <nome>_normal.png
##  (ex.: brick_albedo.png). Elas têm prioridade sobre as geradas.
## ============================================================================

const SIZE := 512
const CACHE_DIR := "user://texture_cache/"
const CACHE_VERSION := 5
const TEXTURE_DIR := "res://assets/textures/"

## nome -> [escala_uv (repetições por metro), rugosidade, metálico, força do relevo]
const DEFS := {
	"asphalt": [0.25, 0.93, 0.0, 1.0],
	"sidewalk": [0.5, 0.85, 0.0, 1.2],
	"pavers": [0.5, 0.8, 0.0, 1.4],
	"brick": [0.5, 0.88, 0.0, 1.6],
	"plaster": [0.35, 0.9, 0.0, 0.6],
	"concrete": [0.3, 0.85, 0.0, 0.8],
	"corrugated": [0.5, 0.55, 0.55, 1.6],
	"tiles": [0.5, 0.35, 0.0, 1.0],
	"wood": [0.6, 0.7, 0.0, 1.0],
	"facade": [0.1667, 0.6, 0.1, 1.0],
	"roof": [0.3, 0.95, 0.0, 0.8],
	"metal": [0.5, 0.45, 0.7, 0.4],
	"cardboard": [0.8, 0.9, 0.0, 0.5],
}

static var _textures := {}
static var _materials := {}


## Material com uma cor multiplicada (tijolo/fachada usam branco para manter
## a cor própria da textura).
static func get_material(kind: String, tint := Color.WHITE) -> StandardMaterial3D:
	var key := "%s_%s" % [kind, tint.to_html()]
	if _materials.has(key):
		return _materials[key]
	var def: Array = DEFS.get(kind, DEFS["concrete"])
	var tex := _get_textures(kind)
	var m := StandardMaterial3D.new()
	m.albedo_texture = tex.albedo
	m.albedo_color = tint
	m.normal_enabled = true
	m.normal_texture = tex.normal
	m.normal_scale = def[3]
	m.roughness = 1.0 if tex.roughness else def[1]
	m.roughness_texture = tex.roughness
	m.roughness_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_RED
	m.metallic = def[2]
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_triplanar_sharpness = 4.0
	m.uv1_scale = Vector3.ONE * def[0]
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	_materials[key] = m
	return m


## Tinta de carro (brilho de verniz).
static func car_paint(color: Color) -> StandardMaterial3D:
	var key := "paint_" + color.to_html()
	if _materials.has(key):
		return _materials[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.metallic = 0.45
	m.roughness = 0.35
	m.clearcoat_enabled = true
	m.clearcoat = 0.6
	m.clearcoat_roughness = 0.2
	_materials[key] = m
	return m


static func glass() -> StandardMaterial3D:
	if _materials.has("glass"):
		return _materials["glass"]
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.05, 0.07, 0.08)
	m.metallic = 0.8
	m.roughness = 0.08
	_materials["glass"] = m
	return m


static func plain(color: Color, roughness := 0.8, metallic := 0.0) -> StandardMaterial3D:
	var key := "plain_%s_%.2f_%.2f" % [color.to_html(), roughness, metallic]
	if _materials.has(key):
		return _materials[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = roughness
	m.metallic = metallic
	_materials[key] = m
	return m


static func emissive(color: Color, energy := 3.0) -> StandardMaterial3D:
	var key := "emit_%s_%.1f" % [color.to_html(), energy]
	if _materials.has(key):
		return _materials[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.emission_enabled = true
	m.emission = color
	m.emission_energy_multiplier = energy
	_materials[key] = m
	return m


## Faixas de pintura no chão (sinalização).
static func road_paint(color: Color) -> StandardMaterial3D:
	return plain(color, 0.75)


# ============================================================================
#  Geração de texturas
# ============================================================================
static func _get_textures(kind: String) -> Dictionary:
	if _textures.has(kind):
		return _textures[kind]
	var result := {}
	# 1) Textura real fornecida pelo usuário.
	var user_albedo := TEXTURE_DIR + kind + "_albedo.png"
	var user_normal := TEXTURE_DIR + kind + "_normal.png"
	if ResourceLoader.exists(user_albedo):
		result.albedo = load(user_albedo)
		result.normal = load(user_normal) if ResourceLoader.exists(user_normal) else null
		var user_rough := TEXTURE_DIR + kind + "_roughness.png"
		result.roughness = load(user_rough) if ResourceLoader.exists(user_rough) else null
		_textures[kind] = result
		return result
	# 2) Cache em disco.
	var cache_a := "%s%s_v%d_a.png" % [CACHE_DIR, kind, CACHE_VERSION]
	var cache_n := "%s%s_v%d_n.png" % [CACHE_DIR, kind, CACHE_VERSION]
	var cache_r := "%s%s_v%d_r.png" % [CACHE_DIR, kind, CACHE_VERSION]
	var albedo_img: Image
	var normal_img: Image
	var rough_img: Image
	if FileAccess.file_exists(cache_a) and FileAccess.file_exists(cache_n) and FileAccess.file_exists(cache_r):
		albedo_img = Image.load_from_file(cache_a)
		normal_img = Image.load_from_file(cache_n)
		rough_img = Image.load_from_file(cache_r)
	if albedo_img == null or normal_img == null or rough_img == null:
		var gen := _generate(kind)
		albedo_img = gen[0]
		normal_img = gen[1]
		rough_img = gen[2]
		DirAccess.make_dir_recursive_absolute(CACHE_DIR)
		albedo_img.save_png(cache_a)
		normal_img.save_png(cache_n)
		rough_img.save_png(cache_r)
	albedo_img.generate_mipmaps()
	normal_img.generate_mipmaps()
	rough_img.generate_mipmaps()
	result.albedo = ImageTexture.create_from_image(albedo_img)
	result.normal = ImageTexture.create_from_image(normal_img)
	result.roughness = ImageTexture.create_from_image(rough_img)
	_textures[kind] = result
	return result


## Retorna [albedo, normal, rugosidade] (Images).
## Os padrões são descritos para 256 px; a textura final tem SIZE px
## (mais nitidez de perto), por isso as coordenadas são reescaladas.
static func _generate(kind: String) -> Array:
	var n1 := _noise_image(hash(kind), 0.01, 5)      # manchas grandes
	var n2 := _noise_image(hash(kind) + 1, 0.06, 3)  # granulado
	var n3 := _noise_image(hash(kind) + 2, 0.25, 2)  # micro detalhe
	var albedo := Image.create(SIZE, SIZE, false, Image.FORMAT_RGB8)
	var height := Image.create(SIZE, SIZE, false, Image.FORMAT_RGB8)
	var rough := Image.create(SIZE, SIZE, false, Image.FORMAT_RGB8)
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(kind) * 31
	var base_rough: float = DEFS.get(kind, DEFS["concrete"])[1]
	var k := SIZE / 256
	for y in SIZE:
		for x in SIZE:
			var a := n1.get_pixel(x, y).r
			var b := n2.get_pixel(x, y).r
			var c := n3.get_pixel(x, y).r
			var px := _pixel(kind, x / k, y / k, a, b * 0.7 + c * 0.3, rng)
			var col: Color = px[0]
			col = col.darkened((c - 0.5) * 0.08)
			albedo.set_pixel(x, y, col)
			var h: float = clampf(px[1] + (c - 0.5) * 0.15, 0.0, 1.0)
			height.set_pixel(x, y, Color(h, h, h))
			var r: float = px[2] if px.size() > 2 else base_rough + (b - 0.5) * 0.15 + (c - 0.5) * 0.1
			r = clampf(r, 0.03, 1.0)
			rough.set_pixel(x, y, Color(r, r, r))
	height.bump_map_to_normal_map(6.0)
	return [albedo, height, rough]


static func _noise_image(seed_value: int, freq: float, octaves: int) -> Image:
	var fn := FastNoiseLite.new()
	fn.seed = seed_value
	fn.frequency = freq
	fn.fractal_octaves = octaves
	fn.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	return fn.get_seamless_image(SIZE, SIZE)


## Um pixel de cada material: retorna [cor, altura 0..1].
## Coordenadas: a textura de 256 px cobre (1 / escala) metros.
static func _pixel(kind: String, x: int, y: int, a: float, b: float, rng: RandomNumberGenerator) -> Array:
	match kind:
		"asphalt":
			var v := 0.22 + (a - 0.5) * 0.06 + (b - 0.5) * 0.08
			if b > 0.72:
				v += 0.08  # pedrisco claro
			var wet := smoothstep(0.32, 0.22, a)  # partes úmidas: escuras e brilhantes
			v -= wet * 0.05
			return [Color(v, v, v * 1.02), 0.5 + (b - 0.5) * 0.8, lerpf(0.9 + (b - 0.5) * 0.15, 0.25, wet)]
		"sidewalk":
			# Placas de 1 m (128 px), junta escura.
			var gx := x % 128
			var gy := y % 128
			var seam := gx < 2 or gy < 2
			var tone := 0.5 + (a - 0.5) * 0.12 + (b - 0.5) * 0.05 + _cell_rand(x / 128, y / 128) * 0.04
			if seam:
				return [Color(0.26, 0.26, 0.25), 0.1]
			return [Color(tone, tone * 0.98, tone * 0.95), 0.6 + (b - 0.5) * 0.2]
		"pavers":
			# Blocos 20 x 10 cm em amarração (running bond).
			var bw := 26
			var bh := 13
			var row := y / bh
			var off := (bw / 2) * (row % 2)
			var col := (x + off) / bw
			var ix := (x + off) % bw
			var iy := y % bh
			var joint := ix < 2 or iy < 2
			var r := _cell_rand(col, row)
			if joint:
				return [Color(0.3, 0.29, 0.27), 0.15]
			var base := Color(0.52, 0.48, 0.44).lerp(Color(0.42, 0.4, 0.38), r)
			base = base.darkened((0.5 - a) * 0.2 + (b - 0.5) * 0.1)
			return [base, 0.7 + (b - 0.5) * 0.15]
		"brick":
			# Tijolos ~22 x 7 cm, argamassa clara.
			var bw2 := 28
			var bh2 := 9
			var row2 := y / bh2
			var off2 := (bw2 / 2) * (row2 % 2)
			var col2 := (x + off2) / bw2
			var ix2 := (x + off2) % bw2
			var iy2 := y % bh2
			if ix2 < 2 or iy2 < 2:
				var mv := 0.62 + (b - 0.5) * 0.1
				return [Color(mv, mv * 0.97, mv * 0.92), 0.2]
			var r2 := _cell_rand(col2, row2)
			var c := Color(0.52, 0.24, 0.17).lerp(Color(0.38, 0.2, 0.15), r2)
			if r2 > 0.85:
				c = Color(0.3, 0.16, 0.12)
			c = c.darkened((0.5 - a) * 0.3 + (b - 0.5) * 0.15)
			return [c, 0.75 + (b - 0.5) * 0.2]
		"plaster":
			var v2 := 0.82 + (a - 0.5) * 0.08 + (b - 0.5) * 0.05
			v2 -= smoothstep(0.35, 0.15, a) * 0.05  # sujeira leve
			return [Color(v2, v2, v2), 0.5 + (b - 0.5) * 0.4]
		"concrete":
			var v3 := 0.6 + (a - 0.5) * 0.12 + (b - 0.5) * 0.07
			var line := y % 154 < 2  # marca de forma a cada ~1,2 m
			if line:
				v3 -= 0.12
			return [Color(v3, v3 * 0.99, v3 * 0.97), 0.3 if line else 0.55 + (b - 0.5) * 0.3]
		"corrugated":
			# Ondulações verticais.
			var wave := sin(float(x) / 16.0 * TAU) * 0.5 + 0.5
			var v4 := 0.55 + wave * 0.12 + (a - 0.5) * 0.1
			if a < 0.25:
				v4 -= 0.12  # ferrugem/sujeira
				return [Color(v4 * 1.1, v4 * 0.8, v4 * 0.6), wave]
			return [Color(v4, v4, v4), wave]
		"tiles":
			var tx := x % 64
			var ty := y % 64
			if tx < 2 or ty < 2:
				return [Color(0.35, 0.34, 0.32), 0.1]
			var rt := _cell_rand(x / 64, y / 64)
			var tv := 0.72 + rt * 0.05 + (a - 0.5) * 0.08
			return [Color(tv, tv * 0.98, tv * 0.94), 0.8, 0.25 + (b - 0.5) * 0.15 + (1.0 - a) * 0.15]
		"wood":
			var plank := y / 32
			var iy3 := y % 32
			var grain := sin(float(x) * 0.08 + a * 12.0 + float(plank) * 3.0) * 0.5 + 0.5
			var rw := _cell_rand(plank, (x + plank * 50) / 200)
			var wc := Color(0.45, 0.31, 0.19).lerp(Color(0.33, 0.22, 0.13), rw)
			wc = wc.darkened(grain * 0.15 + (b - 0.5) * 0.1)
			if iy3 < 2:
				return [wc.darkened(0.5), 0.1]
			return [wc, 0.6 + grain * 0.2]
		"facade":
			# Painel de 6 m (256 px): janelas de 1,2 x 1,6 m a cada 3 m.
			var cell := 128
			var cx := x % cell
			var cy := y % cell
			var win := cx > 40 and cx < 90 and cy > 30 and cy < 98
			var frame := cx > 36 and cx < 94 and cy > 26 and cy < 102
			var fv := 0.66 + (a - 0.5) * 0.14
			if win:
				var lit := _cell_rand(x / cell + 3, y / cell + 7)
				var gl := 0.06 + (b - 0.5) * 0.02 + (0.2 if lit > 0.8 else 0.0)
				return [Color(gl, gl * 1.05, gl * 1.1) if lit <= 0.8 else Color(0.35, 0.3, 0.2), 0.2]
			if frame:
				return [Color(0.25, 0.25, 0.25), 0.8]
			return [Color(fv, fv * 0.96, fv * 0.9), 0.5 + (b - 0.5) * 0.3]
		"roof":
			var rv := 0.2 + (a - 0.5) * 0.06 + (b - 0.5) * 0.06
			return [Color(rv, rv, rv), 0.5 + (b - 0.5) * 0.5]
		"metal":
			var mv2 := 0.5 + (a - 0.5) * 0.12 + (b - 0.5) * 0.04
			return [Color(mv2, mv2, mv2 * 1.02), 0.5 + (a - 0.5) * 0.2]
		"cardboard":
			var cv := 0.55 + (a - 0.5) * 0.1 + (b - 0.5) * 0.05
			return [Color(cv, cv * 0.78, cv * 0.52), 0.5 + (b - 0.5) * 0.2]
	return [Color(0.5, 0.5, 0.5), 0.5]


## Valor pseudoaleatório estável por célula (tijolo, placa...).
static func _cell_rand(cx: int, cy: int) -> float:
	var h := absi(hash(Vector2i(cx, cy)))
	return float(h % 1000) / 1000.0
