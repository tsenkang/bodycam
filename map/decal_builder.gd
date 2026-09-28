class_name DecalBuilder
extends RefCounted
## ============================================================================
##  Decals procedurais: sujeira na base das paredes, poças (refletem a luz),
##  manchas de óleo, rachaduras, bueiros e marcas no chão.
##  Decals só aparecem nos renderizadores Forward+ / Mobile.
##  Não são projetados em personagens nem na arma (cull_mask).
## ============================================================================

const TEX_SIZE := 256
## Camadas de render que NÃO recebem decals (arma = 2, personagens = 3).
const CHARACTER_LAYER := 4
const EXCLUDE_MASK := 2 | CHARACTER_LAYER

static var _tex := {}

var parent: Node3D


func _init(p_parent: Node3D) -> void:
	parent = p_parent


# ============================================================================
#  Posicionamento
# ============================================================================
## Sujeira/umidade na base de uma parede. start/end: extremos da parede no
## chão (x,z). normal: lado da parede que recebe o decal.
func wall_grime(start: Vector3, end: Vector3, normal: Vector3, height := 1.4) -> void:
	var along := (end - start)
	var length := along.length()
	if length < 0.5:
		return
	var x_axis := along / length
	var y_axis := normal.normalized()
	var z_axis := x_axis.cross(y_axis)
	if z_axis.y > 0.0:
		x_axis = -x_axis
		z_axis = -z_axis
	var d := _decal("grime", Vector3(length, 0.6, height))
	d.transform = Transform3D(Basis(x_axis, y_axis, z_axis), (start + end) * 0.5 + Vector3(0, height * 0.5, 0) + y_axis * 0.1)
	d.normal_fade = 0.4
	d.modulate = Color(1, 1, 1, 0.9)


func puddle(pos: Vector3, size: float) -> void:
	var d := _decal("puddle", Vector3(size, 0.6, size * randf_range(0.6, 1.0)))
	d.position = pos + Vector3(0, 0.1, 0)
	d.rotation.y = randf() * TAU


func stain(pos: Vector3, size: float, oil := false) -> void:
	var d := _decal("oil" if oil else "stain", Vector3(size, 0.6, size))
	d.position = pos + Vector3(0, 0.1, 0)
	d.rotation.y = randf() * TAU
	d.modulate = Color(1, 1, 1, randf_range(0.5, 0.9))


func crack(pos: Vector3, size: float) -> void:
	var d := _decal("crack", Vector3(size, 0.6, size))
	d.position = pos + Vector3(0, 0.1, 0)
	d.rotation.y = randf() * TAU


func manhole(pos: Vector3) -> void:
	var d := _decal("manhole", Vector3(0.9, 0.4, 0.9))
	d.position = pos + Vector3(0, 0.05, 0)


func _decal(kind: String, size: Vector3) -> Decal:
	var t: Dictionary = _get_textures(kind)
	var d := Decal.new()
	d.size = size
	d.texture_albedo = t.albedo
	if t.has("normal"):
		d.texture_normal = t.normal
	if t.has("orm"):
		d.texture_orm = t.orm
	d.cull_mask = 0xFFFFF & ~EXCLUDE_MASK
	d.upper_fade = 0.3
	d.lower_fade = 0.3
	d.distance_fade_enabled = true
	d.distance_fade_begin = 55.0
	d.distance_fade_length = 15.0
	parent.add_child(d)
	return d


# ============================================================================
#  Texturas
# ============================================================================
static func _get_textures(kind: String) -> Dictionary:
	if _tex.has(kind):
		return _tex[kind]
	var n := FastNoiseLite.new()
	n.seed = hash(kind)
	n.frequency = 0.03
	n.fractal_octaves = 4
	var fine := FastNoiseLite.new()
	fine.seed = hash(kind) + 5
	fine.frequency = 0.15
	var s := TEX_SIZE
	var albedo := Image.create(s, s, false, Image.FORMAT_RGBA8)
	var orm: Image = null
	if kind == "puddle":
		orm = Image.create(s, s, false, Image.FORMAT_RGB8)
	for y in s:
		for x in s:
			var u := float(x) / s
			var v := float(y) / s
			var nv := n.get_noise_2d(x, y) * 0.5 + 0.5
			var fv := fine.get_noise_2d(x, y) * 0.5 + 0.5
			var col := Color(0, 0, 0, 0)
			match kind:
				"grime":
					# Mais escuro embaixo (v = 1 é o chão), com escorridos.
					var drip := fine.get_noise_2d(x * 0.3, y * 0.02) * 0.5 + 0.5
					var a := pow(v, 1.6) * (0.55 + nv * 0.45) + drip * 0.25 * v
					col = Color(0.08, 0.07, 0.05, clampf(a, 0.0, 0.85))
				"puddle", "stain", "oil":
					var r := Vector2(u - 0.5, v - 0.5).length() * 2.0
					var edge := 1.0 - smoothstep(0.45 + nv * 0.4, 0.75 + nv * 0.35, r)
					if kind == "puddle":
						col = Color(0.03, 0.035, 0.04, edge * 0.75)
						var rr := lerpf(1.0, 0.02, edge)
						orm.set_pixel(x, y, Color(1.0, rr, 0.0))
					elif kind == "oil":
						col = Color(0.02, 0.02, 0.025, edge * (0.5 + fv * 0.4))
					else:
						col = Color(0.12, 0.1, 0.08, edge * (0.35 + fv * 0.3))
				"crack":
					var line := absf(n.get_noise_2d(x * 0.7, y * 0.7))
					var branch := absf(fine.get_noise_2d(x * 0.9, y * 0.9))
					var r2 := Vector2(u - 0.5, v - 0.5).length() * 2.0
					var mask := 1.0 - smoothstep(0.6, 1.0, r2)
					var a2 := (1.0 - smoothstep(0.0, 0.035, line)) + (1.0 - smoothstep(0.0, 0.02, branch)) * 0.6
					col = Color(0.03, 0.03, 0.03, clampf(a2 * mask, 0.0, 0.9))
				"manhole":
					var r3 := Vector2(u - 0.5, v - 0.5).length() * 2.0
					if r3 < 0.96:
						var ring := absf(fmod(r3 * 6.0, 1.0) - 0.5) < 0.08
						var cross := absf(u - 0.5) < 0.015 or absf(v - 0.5) < 0.015
						var m := 0.22 + fv * 0.08 - (0.08 if ring or cross else 0.0)
						col = Color(m, m * 0.97, m * 0.93, 1.0)
					elif r3 < 1.0:
						col = Color(0.12, 0.12, 0.12, 1.0)
			albedo.set_pixel(x, y, col)
	albedo.generate_mipmaps()
	var result := {"albedo": ImageTexture.create_from_image(albedo)}
	if orm:
		orm.generate_mipmaps()
		result.orm = ImageTexture.create_from_image(orm)
	_tex[kind] = result
	return result
