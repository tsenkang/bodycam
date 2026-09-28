class_name MapBuilder
extends RefCounted
## ============================================================================
##  MAPA DE TESTE COMPACTO  ("Distrito 7" — tamanho de mapa pequeno/médio)
## ============================================================================
##  Área jogável ≈ 96 x 76 m. Espelhado no eixo X (lado Oeste = equipe 0,
##  lado Leste = equipe 1) para ser justo para as duas equipes.
##
##          N  (z negativo)
##   ┌──────────────────────────────────────────────────────────────┐
##   │[P]══rampa   RUA NORTE (longa distância, carros)   rampa══[P] │
##   │ S   ┌────────┐      carro        ┌────────┐               S  │
##   │ P   │ PRÉDIO │   ┌────────────┐  │ PRÉDIO │               P  │
##   │ A   │  NO    │   │   PRAÇA    │  │  NE    │               A  │
##   │ W   └────────┘   │ monumento  │  └────────┘               W  │
##   │ N   RUA CENTRAL  │  (centro)  │   RUA CENTRAL             N  │
##   │     ┌────────┐   └────────────┘  ┌────────┐                  │
##   │     │ PRÉDIO │                   │ PRÉDIO │                  │
##   │     │  SO    │   beco (flanco)   │  SE    │                  │
##   │     └────────┘                   └────────┘                  │
##   │  ┌───────────────── ARMAZÉM (curta distância) ─────────────┐ │
##   └──┴─────────────────────────────────────────────────────────┴─┘
##          S  (z positivo)
##
##  Rotas principais: Rua Norte, Rua Central/Praça, Armazém.
##  Rotas alternativas: prédios (portas/janelas), beco sul, vão entre prédios.
##  Pontos elevados: plataformas com rampa nos cantos norte (rifle de precisão).
##
##  O cenário é feito com caixas (placeholder). Para arte final, troque as
##  malhas por modelos mantendo as colisões (ou refaça o mapa numa cena .tscn).
## ============================================================================

const WALL_T := 0.3
const NAV_GROUP := &"nav_source"

var _root: Node3D
var _nav_region: NavigationRegion3D
var _geo: Node3D       # entra na navmesh
var _roofs: Node3D     # telhados (fora da navmesh)
var _dynamic: Node3D   # portas e armários (fora da navmesh)
var _data: MapData
var _m := 1.0          # 1 = lado Oeste, -1 = lado Leste (espelho)
var _mats := {}
var _grid: Texture2D


## Constrói o mapa dentro de "root". Retorna { nav_region, map_data }.
func build(root: Node3D) -> Dictionary:
	_root = root
	_data = MapData.new()
	_nav_region = NavigationRegion3D.new()
	_nav_region.name = "Navigation"
	root.add_child(_nav_region)
	_geo = Node3D.new()
	_geo.name = "Geometry"
	_geo.add_to_group(NAV_GROUP)
	_nav_region.add_child(_geo)
	_roofs = Node3D.new()
	_roofs.name = "Roofs"
	root.add_child(_roofs)
	_dynamic = Node3D.new()
	_dynamic.name = "Dynamic"
	root.add_child(_dynamic)

	_grid = _make_grid_texture()
	_m = 1.0
	_build_center()
	for side in [1.0, -1.0]:
		_m = side
		_build_half()
	_m = 1.0
	_nav_region.navigation_mesh = _make_navmesh()
	return {"nav_region": _nav_region, "map_data": _data}


# ============================================================================
#  Estruturas centrais (não espelhadas)
# ============================================================================
func _build_center() -> void:
	# Chão e limites.
	_box(Vector3(0, -0.5, 0), Vector3(97, 1, 77), _mat("asphalt"))
	_decal_plane(Vector3(0, 0.01, 0), Vector2(24, 36), _mat("plaza"))
	_box(Vector3(0, 3.5, -38.5), Vector3(98, 7, 1), _mat("boundary"))
	_box(Vector3(0, 3.5, 38.5), Vector3(98, 7, 1), _mat("boundary"))
	_box(Vector3(-48.5, 3.5, 0), Vector3(1, 7, 78), _mat("boundary"))
	_box(Vector3(48.5, 3.5, 0), Vector3(1, 7, 78), _mat("boundary"))

	# Praça: monumento central bloqueia a linha de visão do meio.
	_box(Vector3(0, 1.75, 0), Vector3(3.5, 3.5, 3.5), _mat("concrete"), true)
	_box(Vector3(0, 4.25, 0), Vector3(1.0, 1.5, 1.0), _mat("metal"))
	_car(Vector2(0, -13), 0.0, Color(0.75, 0.72, 0.62))
	_box(Vector3(0, 0.6, 13), Vector3(5, 1.2, 0.4), _mat("concrete"), true)
	_box(Vector3(0, 0.6, -27), Vector3(1.2, 1.2, 1.2), _mat("crate"), true)
	_box(Vector3(0.1, 0.6, -28.25), Vector3(1.2, 1.2, 1.2), _mat("crate"), true)

	# Armazém (fachada norte e telhado são únicos; o interior é espelhado).
	_wall_x(22.0, -30.0 - WALL_T * 0.5, 30.0 + WALL_T * 0.5, 6.0, [
		[-24.0, 1.6, 0.0, 2.4], [-16.0, 2.0, 1.2, 2.4], [-8.0, 1.4, 0.0, 2.3],
		[0.0, 3.0, 0.0, 3.0],
		[8.0, 1.4, 0.0, 2.3], [16.0, 2.0, 1.2, 2.4], [24.0, 1.6, 0.0, 2.4]], _mat("warehouse"))
	_door_x(-8.0, 22.0, 1.4)
	_door_x(8.0, 22.0, 1.4)
	_roof(Vector3(0, 6.15, 30.1), Vector3(60.6, 0.3, 16.6))
	_box(Vector3(0, 1.2, 27), Vector3(9, 2.4, 1.0), _mat("shelf"), true)
	_box(Vector3(0, 1.2, 32.5), Vector3(9, 2.4, 1.0), _mat("shelf"), true)
	_box(Vector3(-5, 0.6, 35.5), Vector3(1.2, 1.2, 1.2), _mat("crate"), true)
	_box(Vector3(5, 0.6, 24.5), Vector3(1.2, 1.2, 1.2), _mat("crate"), true)

	# Spawns neutros (usados só para renascer, quando seguros).
	_data.add_spawn(Vector3(0, 0, -35), PI, -1)
	_data.add_spawn(Vector3(0, 0, 35.5), 0.0, -1)
	for p in [Vector3(0, 0, -10), Vector3(0, 0, 10), Vector3(0, 0, -24),
			Vector3(0, 0, 29.75), Vector3(0, 0, 35.5), Vector3(0, 0, -33)]:
		_data.patrol_points.append(p)


# ============================================================================
#  Metade do mapa (construída duas vezes: Oeste e Leste espelhado)
#  Coordenadas escritas para o lado OESTE (x negativo).
# ============================================================================
func _build_half() -> void:
	var team := 0 if _m > 0.0 else 1

	# --- Zona de spawn ---------------------------------------------------
	for z in [-28.0, -20.0, -12.0, -4.0, 4.0, 12.0, 20.0, 28.0]:
		_data.add_spawn(_p(-43, 0, z), -PI * 0.5 * _m, team)
	_data.add_spawn(_p(-33, 0, -24), -PI * 0.5 * _m, -1)
	_data.add_spawn(_p(-33, 0, 20), -PI * 0.5 * _m, -1)
	var container := Color(0.22, 0.36, 0.45) if team == 0 else Color(0.55, 0.26, 0.2)
	_box(_p(-38, 1.3, -12), Vector3(2.5, 2.6, 6), _mat_color(container), true)
	_box(_p(-38, 1.3, 12), Vector3(2.5, 2.6, 6), _mat_color(container), true)
	_box(_p(-35, 0.55, 0), Vector3(0.6, 1.1, 3), _mat("concrete"), true)

	# --- Plataforma elevada + rampa (canto norte) --------------------------
	_box(_p(-28, 3.0, -35.25), Vector3(6, 0.4, 4.5), _mat("metal"))
	for c in [Vector2(-30.7, -37.2), Vector2(-25.3, -37.2), Vector2(-30.7, -33.3), Vector2(-25.3, -33.3)]:
		_box(_p(c.x, 1.4, c.y), Vector3(0.3, 2.8, 0.3), _mat("metal"))
	_box(_p(-25.1, 3.7, -35.25), Vector3(0.2, 1.0, 4.5), _mat("concrete"), true)
	_box(_p(-28, 3.7, -33.1), Vector3(6, 1.0, 0.2), _mat("concrete"), true)
	_ramp(_p(-39, 0, -35.25), _p(-31, 3.2, -35.25), 2.4)
	_locker(&"sniper", _p(-29.5, 3.2, -37.1), Color(0.3, 0.6, 1.0))

	# --- Rua Norte (longa distância) -------------------------------------
	_car(Vector2(-21, -28), 0.1, Color(0.55, 0.12, 0.1))
	_car(Vector2(-9, -32), -0.35, Color(0.15, 0.22, 0.4))
	_box(_p(-15, 0.55, -23.5), Vector3(3, 1.1, 0.6), _mat("concrete"), true)
	_box(_p(-33, 0.55, -27), Vector3(0.6, 1.1, 3), _mat("concrete"), true)
	_box(_p(-4.5, 0.6, -24.5), Vector3(1.2, 1.2, 1.2), _mat("crate"), true)
	_box(_p(-27, 1.25, -22), Vector3(3, 2.5, 1.2), _mat("kiosk"), true)

	# --- Prédio Norte (NO/NE): 2 salas, portas e janelas ------------------
	_building(-30, -12, -18, -8, 4.0,
		[[-26.0, 1.4, 0.0, 2.3], [-19.0, 2.0, 1.1, 2.1], [-15.0, 1.6, 0.0, 2.4]],
		[[-27.0, 2.0, 1.1, 2.1], [-24.0, 1.6, 0.0, 2.4], [-16.0, 2.0, 1.1, 2.1]],
		[[-13.0, 1.6, 0.0, 2.4]],
		[[-15.5, 2.0, 1.1, 2.1], [-11.0, 1.6, 0.0, 2.4]], _mat("wall_a"))
	_wall_z(-21.0, -18.0 + WALL_T * 0.5, -8.0 - WALL_T * 0.5, 4.0, [[-11.0, 1.4, 0.0, 2.3]], _mat("wall_a"))
	_door_x(-26.0, -18.0, 1.4)
	_box(_p(-26.5, 0.45, -12.5), Vector3(1.8, 0.9, 0.9), _mat("wood"), true)
	_box(_p(-14, 1.0, -17.4), Vector3(2.0, 2.0, 0.5), _mat("shelf"))
	_box(_p(-17, 0.6, -10), Vector3(1.2, 1.2, 1.2), _mat("crate"), true)
	_locker(&"ak47", _p(-29, 0.0, -9.0), Color(1.0, 0.55, 0.2))

	# --- Rua Central (média distância) ------------------------------------
	_box(_p(-24, 1.4, 2.5), Vector3(5.5, 2.8, 2.4), _mat_color(Color(0.35, 0.37, 0.33)), true)
	_box(_p(-20.3, 1.1, 2.5), Vector3(1.9, 2.2, 2.3), _mat_color(Color(0.8, 0.8, 0.78)), true)
	_box(_p(-17, 0.55, -3.5), Vector3(3, 1.1, 0.6), _mat("concrete"), true)
	_box(_p(-29, 0.6, -4.5), Vector3(1.2, 1.2, 1.2), _mat("crate"), true)
	_box(_p(-29, 1.8, -4.5), Vector3(1.2, 1.2, 1.2), _mat("crate"))
	_box(_p(-13.5, 0.55, 4.5), Vector3(0.8, 1.1, 3), _mat("sandbag"), true)

	# --- Praça (metade) ----------------------------------------------------
	_box(_p(-6, 0.55, -5), Vector3(3, 1.1, 1.2), _mat("planter"), true)
	_box(_p(-6, 0.55, 5), Vector3(3, 1.1, 1.2), _mat("planter"), true)
	_box(_p(-9, 0.6, 0.5), Vector3(1.2, 1.2, 1.2), _mat("crate"), true)
	_box(_p(-7, 0.6, -15), Vector3(1.2, 1.2, 2.4), _mat("crate"), true)
	_box(_p(-7, 0.6, 15.5), Vector3(1.2, 1.2, 1.2), _mat("crate"), true)

	# --- Prédio Sul (SO/SE): 3 salas ---------------------------------------
	_building(-30, -12, 8, 18, 4.0,
		[[-27.0, 1.6, 0.0, 2.4], [-21.0, 2.0, 1.1, 2.1], [-15.0, 1.4, 0.0, 2.3]],
		[[-27.0, 2.0, 1.1, 2.1], [-21.0, 1.6, 0.0, 2.4], [-15.0, 2.0, 1.1, 2.1]],
		[[13.0, 2.0, 1.1, 2.1]],
		[[11.0, 1.6, 0.0, 2.4], [15.0, 2.0, 1.1, 2.1]], _mat("wall_b"))
	_wall_z(-24.0, 8.0 + WALL_T * 0.5, 18.0 - WALL_T * 0.5, 4.0, [[15.0, 1.4, 0.0, 2.3]], _mat("wall_b"))
	_wall_z(-18.0, 8.0 + WALL_T * 0.5, 18.0 - WALL_T * 0.5, 4.0, [[11.0, 1.4, 0.0, 2.3]], _mat("wall_b"))
	_door_x(-15.0, 8.0, 1.4)
	_box(_p(-26.5, 0.6, 16.5), Vector3(1.2, 1.2, 1.2), _mat("crate"), true)
	_box(_p(-15, 0.6, 16.3), Vector3(1.2, 1.2, 1.2), _mat("crate"), true)
	_box(_p(-21, 0.45, 12), Vector3(1.6, 0.9, 1.6), _mat("wood"), true)

	# --- Beco sul (rota de flanco) -----------------------------------------
	_box(_p(-33, 0.6, 20), Vector3(1.2, 1.2, 1.2), _mat("crate"), true)
	_box(_p(-8, 0.6, 20), Vector3(0.8, 1.2, 0.8), _mat("metal"), true)
	_box(_p(-19, 0.6, 20.3), Vector3(2.0, 1.2, 1.0), _mat("crate"), true)

	# --- Armazém (curta distância) -----------------------------------------
	_wall_z(-30.0, 22.0 + WALL_T * 0.5, 38.0, 6.0, [[29.0, 2.4, 0.0, 3.0]], _mat("warehouse"))
	_wall_z(-12.0, 22.0 + WALL_T * 0.5, 38.0, 6.0, [[25.5, 1.4, 0.0, 2.3], [34.0, 1.6, 0.0, 2.4]], _mat("warehouse"))
	_wall_x(30.0, -30.0 + WALL_T * 0.5, -12.0 - WALL_T * 0.5, 6.0, [[-21.0, 1.6, 0.0, 2.4], [-26.0, 2.0, 1.1, 2.1]], _mat("warehouse"))
	_door_z(-12.0, 25.5, 1.4)
	_box(_p(-16, 0.6, 26), Vector3(1.2, 1.2, 1.2), _mat("crate"), true)
	_box(_p(-25, 0.6, 35.5), Vector3(1.2, 1.2, 1.2), _mat("crate"), true)
	_box(_p(-16, 0.8, 34.5), Vector3(1.6, 1.6, 1.6), _mat("crate"), true)
	_locker(&"shotgun", _p(-28.5, 0.0, 23.0), Color(0.9, 0.25, 0.25))

	# --- Pontos de patrulha -------------------------------------------------
	for p in [Vector3(-41, 0, -30), Vector3(-41, 0, 0), Vector3(-41, 0, 30), Vector3(-28, 3.2, -35.2),
			Vector3(-21, 0, -25), Vector3(-9, 0, -27), Vector3(-25, 0, -13), Vector3(-16, 0, -13),
			Vector3(-24, 0, -2), Vector3(-15, 0, 1), Vector3(-8, 0, -6), Vector3(-8, 0, 6),
			Vector3(-27, 0, 13), Vector3(-21, 0, 14), Vector3(-15, 0, 13), Vector3(-20, 0, 20),
			Vector3(-24, 0, 26), Vector3(-24, 0, 34), Vector3(-16, 0, 28), Vector3(-6, 0, 30),
			Vector3(-34, 0, -30), Vector3(-34, 0, 26)]:
		_data.patrol_points.append(_p(p.x, p.y, p.z))


# ============================================================================
#  Construtores
# ============================================================================
## Espelha uma coordenada escrita para o lado Oeste.
func _p(x: float, y: float, z: float) -> Vector3:
	return Vector3(x * _m, y, z)


func _box(center: Vector3, size: Vector3, mat: Material, cover := false, rot_y := 0.0, parent: Node3D = null) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.collision_layer = Layers.WORLD
	body.collision_mask = 0
	body.position = center
	body.rotation.y = rot_y
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat
	body.add_child(mi)
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	cs.shape = shape
	body.add_child(cs)
	(parent if parent else _geo).add_child(body)
	if cover:
		_add_cover_points(center, size, rot_y)
	return body


## Pontos de cobertura em volta de um objeto (a IA escolhe os escondidos).
func _add_cover_points(center: Vector3, size: Vector3, rot_y: float) -> void:
	var base_y := center.y - size.y * 0.5
	var basis := Basis(Vector3.UP, rot_y)
	var off := 0.75
	for axis in [Vector3.RIGHT, Vector3.BACK]:
		var half_normal: float = (size.x if axis == Vector3.RIGHT else size.z) * 0.5 + off
		var along: Vector3 = Vector3.BACK if axis == Vector3.RIGHT else Vector3.RIGHT
		var length: float = size.z if axis == Vector3.RIGHT else size.x
		var count := maxi(1, int(length / 2.0))
		for side in [-1.0, 1.0]:
			for i in count:
				var t := (float(i) + 0.5) / count - 0.5
				var local: Vector3 = axis * half_normal * side + along * t * length
				var p := center + basis * local
				_data.cover_points.append(Vector3(p.x, base_y, p.z))


## Parede ao longo do eixo X (coordenadas do lado Oeste; é espelhada).
## openings: [[centro_x, largura, y_base, y_topo], ...]
func _wall_x(z: float, x0: float, x1: float, h: float, openings: Array, mat: Material) -> void:
	for seg in _wall_segments(minf(x0, x1), maxf(x0, x1), h, openings):
		var cx: float = (seg[0] + seg[1]) * 0.5
		_box(_p(cx, (seg[2] + seg[3]) * 0.5, z), Vector3(seg[1] - seg[0], seg[3] - seg[2], WALL_T), mat)


## Parede ao longo do eixo Z em x fixo (espelhada).
func _wall_z(x: float, z0: float, z1: float, h: float, openings: Array, mat: Material) -> void:
	for seg in _wall_segments(minf(z0, z1), maxf(z0, z1), h, openings):
		var cz: float = (seg[0] + seg[1]) * 0.5
		_box(_p(x, (seg[2] + seg[3]) * 0.5, cz), Vector3(WALL_T, seg[3] - seg[2], seg[1] - seg[0]), mat)


## Divide uma parede em pedaços contornando portas e janelas.
## Retorna [[s0, s1, y0, y1], ...].
func _wall_segments(a: float, b: float, h: float, openings: Array) -> Array:
	var ops := openings.duplicate()
	ops.sort_custom(func(o1, o2): return o1[0] < o2[0])
	var out := []
	var cursor := a
	for o in ops:
		var o0: float = o[0] - o[1] * 0.5
		var o1: float = o[0] + o[1] * 0.5
		if o0 > cursor + 0.01:
			out.append([cursor, o0, 0.0, h])
		if o[2] > 0.01:
			out.append([o0, o1, 0.0, o[2]])
		if o[3] < h - 0.01:
			out.append([o0, o1, o[3], h])
		cursor = o1
	if cursor < b - 0.01:
		out.append([cursor, b, 0.0, h])
	return out


## Prédio retangular com telhado. open_*: aberturas de cada parede.
func _building(x0: float, x1: float, z0: float, z1: float, h: float,
		open_n: Array, open_s: Array, open_w: Array, open_e: Array, mat: Material) -> void:
	var t := WALL_T * 0.5
	_wall_x(z0, x0 - t, x1 + t, h, open_n, mat)
	_wall_x(z1, x0 - t, x1 + t, h, open_s, mat)
	_wall_z(x0, z0 + t, z1 - t, h, open_w, mat)
	_wall_z(x1, z0 + t, z1 - t, h, open_e, mat)
	_roof(_p((x0 + x1) * 0.5, h + 0.15, (z0 + z1) * 0.5), Vector3(absf(x1 - x0) + 0.6, 0.3, absf(z1 - z0) + 0.6))


func _roof(center: Vector3, size: Vector3) -> void:
	_box(center, size, _mat("roof"), false, 0.0, _roofs)


func _ramp(bottom: Vector3, top: Vector3, width: float) -> void:
	var dir := top - bottom
	var forward := dir.normalized()
	var side := forward.cross(Vector3.UP).normalized()
	var up := side.cross(forward).normalized()
	var thickness := 0.3
	var body := _box(Vector3.ZERO, Vector3(width, thickness, dir.length()), _mat("metal"))
	body.transform = Transform3D(Basis(-side, up, forward), (bottom + top) * 0.5 - up * thickness * 0.5)


func _car(center_xz: Vector2, rot_y: float, color: Color) -> void:
	var c := _p(center_xz.x, 0.0, center_xz.y)
	var r := rot_y * _m
	_box(c + Vector3(0, 0.6, 0), Vector3(4.3, 0.9, 1.9), _mat_color(color), true, r)
	var cabin_off := Basis(Vector3.UP, r) * Vector3(-0.3, 0, 0)
	_box(c + cabin_off + Vector3(0, 1.35, 0), Vector3(2.3, 0.6, 1.7), _mat_color(color.darkened(0.35)), false, r)
	# Rodas (só visual, sem colisão extra).
	for w in [Vector2(1.4, 0.95), Vector2(-1.4, 0.95), Vector2(1.4, -0.95), Vector2(-1.4, -0.95)]:
		var mi := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.35
		cm.bottom_radius = 0.35
		cm.height = 0.25
		mi.mesh = cm
		mi.material_override = _mat("tire")
		mi.position = c + Basis(Vector3.UP, r) * Vector3(w.x, 0.35, w.y)
		mi.rotation = Vector3(PI * 0.5, r, 0)
		_geo.add_child(mi)


func _decal_plane(center: Vector3, size: Vector2, mat: Material) -> void:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = size
	mi.mesh = pm
	mi.material_override = mat
	mi.position = center
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_root.add_child(mi)


## Porta numa parede ao longo de X. center_x = centro da abertura.
func _door_x(center_x: float, z: float, width: float) -> void:
	var d := Door.new()
	_dynamic.add_child(d)
	d.setup(_p(center_x - width * 0.5, 0.0, z), Vector3(_m, 0, 0), width, _mat("door"))


## Porta numa parede ao longo de Z.
func _door_z(x: float, center_z: float, width: float) -> void:
	var d := Door.new()
	_dynamic.add_child(d)
	d.setup(_p(x, 0.0, center_z - width * 0.5), Vector3(0, 0, 1), width, _mat("door"))


func _locker(id: StringName, pos: Vector3, color: Color) -> void:
	var l := WeaponLocker.new()
	l.position = pos
	_dynamic.add_child(l)
	l.setup(id, color)


# ============================================================================
#  Navmesh
# ============================================================================
func _make_navmesh() -> NavigationMesh:
	var nm := NavigationMesh.new()
	# Valores múltiplos do tamanho da célula (0,25) para não perder precisão.
	nm.agent_radius = 0.5
	nm.agent_height = 1.75
	nm.agent_max_climb = 0.25
	nm.agent_max_slope = 40.0
	nm.cell_size = 0.25
	nm.cell_height = 0.25
	nm.geometry_parsed_geometry_type = NavigationMesh.PARSED_GEOMETRY_STATIC_COLLIDERS
	nm.geometry_collision_mask = Layers.WORLD
	nm.geometry_source_geometry_mode = NavigationMesh.SOURCE_GEOMETRY_GROUPS_WITH_CHILDREN
	nm.geometry_source_group_name = NAV_GROUP
	return nm


# ============================================================================
#  Materiais (textura de grade gerada — ajuda a perceber velocidade/escala)
# ============================================================================
const PALETTE := {
	"asphalt": Color(0.38, 0.38, 0.39),
	"plaza": Color(0.62, 0.6, 0.56),
	"boundary": Color(0.46, 0.46, 0.47),
	"concrete": Color(0.64, 0.64, 0.62),
	"wall_a": Color(0.74, 0.69, 0.6),
	"wall_b": Color(0.56, 0.61, 0.63),
	"warehouse": Color(0.52, 0.49, 0.44),
	"roof": Color(0.28, 0.28, 0.29),
	"crate": Color(0.56, 0.43, 0.26),
	"wood": Color(0.42, 0.3, 0.2),
	"shelf": Color(0.3, 0.33, 0.36),
	"metal": Color(0.36, 0.37, 0.38),
	"kiosk": Color(0.3, 0.45, 0.35),
	"planter": Color(0.45, 0.42, 0.38),
	"sandbag": Color(0.55, 0.5, 0.38),
	"door": Color(0.36, 0.26, 0.18),
	"tire": Color(0.08, 0.08, 0.08),
}


func _mat(key: String) -> StandardMaterial3D:
	return _mat_color(PALETTE.get(key, Color.MAGENTA))


func _mat_color(color: Color) -> StandardMaterial3D:
	var k := color.to_html()
	if _mats.has(k):
		return _mats[k]
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.albedo_texture = _grid
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_scale = Vector3(0.5, 0.5, 0.5)
	m.roughness = 0.9
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	_mats[k] = m
	return m


func _make_grid_texture() -> Texture2D:
	var size := 256
	var img := Image.create(size, size, false, Image.FORMAT_RGB8)
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for y in size:
		for x in size:
			var v := 0.82 + rng.randf_range(-0.035, 0.035)
			if x % 128 < 3 or y % 128 < 3:
				v = 0.58
			elif x % 32 == 0 or y % 32 == 0:
				v -= 0.08
			img.set_pixel(x, y, Color(v, v, v))
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)
