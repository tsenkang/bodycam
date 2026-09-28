class_name WeaponModelBuilder
extends RefCounted
## Monta modelos PLACEHOLDER das armas (primeira pessoa) com formas simples.
##
## Convenções (importante se for trocar por um modelo real):
##   - A arma aponta para -Z.
##   - A linha de mira fica em x = 0 e y = sight_height.
##   - Um nó "Muzzle" marca a ponta do cano.
## Para usar um modelo próprio, preencha "model_scene" em weapon_config.gd
## com o caminho de um .tscn/.glb que siga essas convenções e tenha um nó
## filho chamado "Muzzle". Opcionalmente "Pump", "Slide" ou "Bolt".

const VIEWMODEL_FOV := 62.0

static var _materials := {}


## Retorna { root: Node3D, sight_height: float, muzzle: Node3D, parts: Dictionary }
static func build(data: WeaponData) -> Dictionary:
	if data.model_scene != "" and ResourceLoader.exists(data.model_scene):
		var scene: PackedScene = load(data.model_scene)
		var inst: Node3D = scene.instantiate()
		_apply_viewmodel_flags(inst)
		var m: Node3D = inst.find_child("Muzzle", true, false)
		if m == null:
			m = Node3D.new()
			m.position = Vector3(0, 0.03, -0.5)
			inst.add_child(m)
		return {
			"root": inst,
			"sight_height": float(inst.get_meta("sight_height", 0.07)),
			"muzzle": m,
			"parts": {
				"pump": inst.find_child("Pump", true, false),
				"slide": inst.find_child("Slide", true, false),
				"bolt": inst.find_child("Bolt", true, false),
			},
		}
	match data.model_type:
		"pistol":
			return _pistol(data)
		"shotgun":
			return _shotgun(data)
		"rifle":
			return _rifle(data)
		"sniper":
			return _sniper(data)
	return _smg(data)


# ---------------------------------------------------------------------------
static func _smg(d: WeaponData) -> Dictionary:
	var r := Node3D.new()
	var body := _mat(d.model_color)
	var dark := _mat(d.model_color.darkened(0.4))
	_box(r, Vector3(0.07, 0.09, 0.34), Vector3(0, 0, -0.05), body)             # receptor
	_box(r, Vector3(0.075, 0.07, 0.15), Vector3(0, -0.005, -0.28), dark)       # guarda-mão
	_cyl(r, 0.014, 0.14, Vector3(0, 0.01, -0.41), dark)                        # cano
	_box(r, Vector3(0.045, 0.2, 0.06), Vector3(0, -0.14, -0.12), dark, Vector3(-8, 0, 0))  # carregador
	_box(r, Vector3(0.045, 0.12, 0.06), Vector3(0, -0.09, 0.07), dark, Vector3(15, 0, 0))  # empunhadura
	_box(r, Vector3(0.04, 0.07, 0.2), Vector3(0, -0.01, 0.22), body)           # coronha
	var sh := _iron_sights(r, 0.045, 0.03, 0.06, -0.33, dark)
	_hands(r, Vector3(0.0, -0.1, 0.07), Vector3(0.0, -0.05, -0.27))
	return _result(r, sh, Vector3(0, 0.01, -0.49), {})


static func _pistol(d: WeaponData) -> Dictionary:
	var r := Node3D.new()
	var body := _mat(d.model_color)
	var dark := _mat(d.model_color.darkened(0.35))
	var slide := Node3D.new()
	slide.name = "Slide"
	r.add_child(slide)
	_box(slide, Vector3(0.034, 0.045, 0.19), Vector3(0, 0, -0.04), body)
	_box(r, Vector3(0.032, 0.03, 0.17), Vector3(0, -0.036, -0.035), dark)
	_box(r, Vector3(0.032, 0.11, 0.05), Vector3(0, -0.09, 0.03), dark, Vector3(18, 0, 0))
	var sh := _iron_sights(slide, 0.0225, 0.012, 0.04, -0.125, dark)
	_hands(r, Vector3(0.0, -0.1, 0.03), Vector3(-0.01, -0.105, 0.02), true)
	return _result(r, sh, Vector3(0, 0.0, -0.15), {"slide": slide})


static func _shotgun(d: WeaponData) -> Dictionary:
	var r := Node3D.new()
	var body := _mat(d.model_color)
	var wood := _mat(Color(0.33, 0.22, 0.13))
	var dark := _mat(d.model_color.darkened(0.4))
	_box(r, Vector3(0.06, 0.08, 0.25), Vector3(0, 0, -0.02), body)
	_cyl(r, 0.016, 0.5, Vector3(0, 0.015, -0.39), dark)
	_cyl(r, 0.013, 0.4, Vector3(0, -0.022, -0.35), dark)
	var pump := Node3D.new()
	pump.name = "Pump"
	r.add_child(pump)
	_box(pump, Vector3(0.055, 0.055, 0.15), Vector3(0, -0.022, -0.3), wood)
	_box(r, Vector3(0.045, 0.1, 0.06), Vector3(0, -0.08, 0.1), wood, Vector3(20, 0, 0))
	_box(r, Vector3(0.045, 0.08, 0.26), Vector3(0, -0.03, 0.25), wood)
	# Mira simples: "conta" na ponta do cano.
	var bead := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.006
	sm.height = 0.012
	bead.mesh = sm
	bead.material_override = _mat(Color(0.9, 0.9, 0.85))
	bead.position = Vector3(0, 0.037, -0.62)
	_prep(bead)
	r.add_child(bead)
	_hands(r, Vector3(0.0, -0.1, 0.1), Vector3(0.0, -0.05, -0.3))
	return _result(r, 0.043, Vector3(0, 0.015, -0.65), {"pump": pump})


static func _rifle(d: WeaponData) -> Dictionary:
	var r := Node3D.new()
	var body := _mat(d.model_color)
	var wood := _mat(Color(0.4, 0.24, 0.12))
	var dark := _mat(d.model_color.darkened(0.4))
	_box(r, Vector3(0.06, 0.08, 0.36), Vector3(0, 0, -0.04), body)
	_box(r, Vector3(0.065, 0.065, 0.2), Vector3(0, -0.005, -0.3), wood)
	_cyl(r, 0.012, 0.22, Vector3(0, 0.012, -0.5), dark)
	# Carregador curvo (dois blocos inclinados).
	_box(r, Vector3(0.045, 0.12, 0.07), Vector3(0, -0.1, -0.1), dark, Vector3(-10, 0, 0))
	_box(r, Vector3(0.045, 0.1, 0.07), Vector3(0, -0.19, -0.13), dark, Vector3(-25, 0, 0))
	_box(r, Vector3(0.042, 0.11, 0.055), Vector3(0, -0.085, 0.09), dark, Vector3(16, 0, 0))
	_box(r, Vector3(0.045, 0.08, 0.28), Vector3(0, -0.02, 0.29), wood)
	var sh := _iron_sights(r, 0.04, 0.03, 0.03, -0.55, dark)
	_hands(r, Vector3(0.0, -0.1, 0.09), Vector3(0.0, -0.05, -0.3))
	return _result(r, sh, Vector3(0, 0.012, -0.62), {})


static func _sniper(d: WeaponData) -> Dictionary:
	var r := Node3D.new()
	var body := _mat(d.model_color)
	var dark := _mat(d.model_color.darkened(0.5))
	_box(r, Vector3(0.06, 0.075, 0.42), Vector3(0, 0, -0.02), body)
	_cyl(r, 0.013, 0.6, Vector3(0, 0.01, -0.52), dark)
	_box(r, Vector3(0.05, 0.12, 0.34), Vector3(0, -0.035, 0.32), body)
	_box(r, Vector3(0.042, 0.11, 0.055), Vector3(0, -0.085, 0.1), dark, Vector3(16, 0, 0))
	_box(r, Vector3(0.045, 0.08, 0.07), Vector3(0, -0.075, -0.08), dark)
	# Luneta.
	_cyl(r, 0.022, 0.3, Vector3(0, 0.08, -0.05), dark)
	_cyl(r, 0.03, 0.06, Vector3(0, 0.08, -0.2), dark)
	_cyl(r, 0.028, 0.05, Vector3(0, 0.08, 0.1), dark)
	_box(r, Vector3(0.02, 0.04, 0.02), Vector3(0, 0.045, -0.12), dark)
	_box(r, Vector3(0.02, 0.04, 0.02), Vector3(0, 0.045, 0.03), dark)
	var bolt := Node3D.new()
	bolt.name = "Bolt"
	bolt.position = Vector3(0.04, 0.01, 0.1)
	r.add_child(bolt)
	_box(bolt, Vector3(0.06, 0.015, 0.015), Vector3(0.02, 0, 0), dark)
	_hands(r, Vector3(0.0, -0.1, 0.1), Vector3(0.0, -0.05, -0.3))
	return _result(r, 0.08, Vector3(0, 0.01, -0.83), {"bolt": bolt})


# ---------------------------------------------------------------------------
## Alça de mira (dois postes) + massa de mira (um poste). Retorna a altura.
static func _iron_sights(parent: Node3D, top: float, post_h: float, rear_z: float, front_z: float, mat: Material) -> float:
	for side in [-1.0, 1.0]:
		_box(parent, Vector3(0.008, post_h, 0.012), Vector3(0.011 * side, top + post_h * 0.5, rear_z), mat)
	_box(parent, Vector3(0.005, post_h, 0.008), Vector3(0, top + post_h * 0.5, front_z), mat)
	return top + post_h


## Luvas e mangas (dão a sensação de "mãos" em primeira pessoa).
static func _hands(parent: Node3D, grip: Vector3, support: Vector3, pistol := false) -> void:
	var glove := _mat(Color(0.1, 0.1, 0.1))
	var sleeve := _mat(Color(0.22, 0.24, 0.2))
	_box(parent, Vector3(0.06, 0.07, 0.09), grip + Vector3(0.012, 0.0, 0.0), glove)
	var fa := _box(parent, Vector3(0.075, 0.075, 0.32), grip + Vector3(0.05, -0.06, 0.2), sleeve)
	fa.rotation_degrees = Vector3(18, -12, 0)
	if pistol:
		_box(parent, Vector3(0.06, 0.065, 0.085), support + Vector3(-0.03, 0.0, 0.0), glove)
		var fa2 := _box(parent, Vector3(0.075, 0.075, 0.32), support + Vector3(-0.1, -0.06, 0.2), sleeve)
		fa2.rotation_degrees = Vector3(18, 25, 0)
	else:
		_box(parent, Vector3(0.075, 0.06, 0.1), support + Vector3(0, -0.035, 0), glove)
		var fa3 := _box(parent, Vector3(0.075, 0.075, 0.36), support + Vector3(-0.1, -0.1, 0.18), sleeve)
		fa3.rotation_degrees = Vector3(22, 32, 0)


static func _result(root: Node3D, sight_height: float, muzzle_pos: Vector3, parts: Dictionary) -> Dictionary:
	var muzzle := Node3D.new()
	muzzle.name = "Muzzle"
	muzzle.position = muzzle_pos
	root.add_child(muzzle)
	return {"root": root, "sight_height": sight_height, "muzzle": muzzle, "parts": parts}


static func _box(parent: Node3D, size: Vector3, pos: Vector3, mat: Material, rot_deg := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat
	mi.position = pos
	mi.rotation_degrees = rot_deg
	_prep(mi)
	parent.add_child(mi)
	return mi


static func _cyl(parent: Node3D, radius: float, length: float, pos: Vector3, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = radius
	cm.bottom_radius = radius
	cm.height = length
	cm.radial_segments = 12
	cm.rings = 1
	mi.mesh = cm
	mi.material_override = mat
	mi.position = pos
	mi.rotation_degrees = Vector3(90, 0, 0)
	_prep(mi)
	parent.add_child(mi)
	return mi


static func _prep(mi: GeometryInstance3D) -> void:
	# A arma em 1ª pessoa não projeta sombra no mundo.
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF


## Material com FOV próprio e "z-clip" reduzido: a arma não atravessa
## paredes e não distorce com o FOV largo da bodycam.
static func _mat(color: Color) -> StandardMaterial3D:
	var key := color.to_html()
	if _materials.has(key):
		return _materials[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = 0.6
	m.metallic = 0.3
	_set_viewmodel_flags(m)
	_materials[key] = m
	return m


static func _set_viewmodel_flags(m: BaseMaterial3D) -> void:
	m.use_z_clip_scale = true
	m.z_clip_scale = 0.35
	m.use_fov_override = true
	m.fov_override = VIEWMODEL_FOV


static func _apply_viewmodel_flags(node: Node) -> void:
	if node is MeshInstance3D:
		var mi := node as MeshInstance3D
		_prep(mi)
		for i in mi.get_surface_override_material_count():
			var mat := mi.get_active_material(i)
			if mat is BaseMaterial3D:
				var dup: BaseMaterial3D = mat.duplicate()
				_set_viewmodel_flags(dup)
				mi.set_surface_override_material(i, dup)
	for c in node.get_children():
		_apply_viewmodel_flags(c)
