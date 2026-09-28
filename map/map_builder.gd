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
##  Visual: materiais procedurais realistas (map_materials.gd) e objetos de
##  cenário (prop_builder.gd). Para arte final, troque as malhas por modelos
##  mantendo as colisões (ou refaça o mapa numa cena .tscn).
## ============================================================================

const WALL_T := 0.3
const NAV_GROUP := &"nav_source"

## Materiais de cada parte do mapa: chave -> [tipo em MapMaterials, cor].
const MATERIALS := {
	"asphalt": ["asphalt", Color(1, 1, 1)],
	"plaza": ["pavers", Color(1, 1, 1)],
	"sidewalk": ["sidewalk", Color(1, 1, 1)],
	"boundary": ["facade", Color(0.95, 0.92, 0.86)],
	"concrete": ["concrete", Color(1, 1, 1)],
	"wall_a": ["brick", Color(1, 1, 1)],
	"wall_b": ["plaster", Color(0.72, 0.77, 0.8)],
	"interior_a": ["plaster", Color(0.86, 0.83, 0.76)],
	"warehouse": ["corrugated", Color(0.62, 0.66, 0.7)],
	"warehouse_floor": ["concrete", Color(0.75, 0.75, 0.74)],
	"floor_tiles": ["tiles", Color(1, 1, 1)],
	"floor_wood": ["wood", Color(0.9, 0.85, 0.8)],
	"roof": ["roof", Color(1, 1, 1)],
	"crate": ["wood", Color(0.95, 0.85, 0.7)],
	"wood": ["wood", Color(0.75, 0.65, 0.55)],
	"shelf": ["metal", Color(0.3, 0.42, 0.6)],
	"metal": ["metal", Color(0.55, 0.56, 0.58)],
	"kiosk": ["plaster", Color(0.45, 0.6, 0.5)],
	"planter": ["concrete", Color(0.85, 0.82, 0.78)],
	"sandbag": ["cardboard", Color(0.95, 1.0, 0.9)],
	"door": ["wood", Color(0.6, 0.45, 0.35)],
	"jersey": ["concrete", Color(0.9, 0.9, 0.88)],
}

var _root: Node3D
var _nav_region: NavigationRegion3D
var _geo: Node3D       # entra na navmesh
var _roofs: Node3D     # telhados (fora da navmesh)
var _dynamic: Node3D   # portas e armários (fora da navmesh)
var _detail: Node3D    # detalhes só visuais (fora da navmesh)
var _props: PropBuilder
var _decals: DecalBuilder
var _data: MapData
var _m := 1.0          # 1 = lado Oeste, -1 = lado Leste (espelho)


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
	_detail = Node3D.new()
	_detail.name = "Detail"
	root.add_child(_detail)

	var lighting: Dictionary = GameConfig.get_lighting()
	_props = PropBuilder.new(_geo, _detail, _data)
	_props.street_lights = lighting.street_lights
	_props.interior_light_energy = lighting.interior_light_energy
	_decals = DecalBuilder.new(_detail)

	_m = 1.0
	_build_center()
	for side in [1.0, -1.0]:
		_m = side
		seed(1234)  # os dois lados ficam com os mesmos detalhes aleatórios
		_build_half()
	_m = 1.0
	_build_skyline()
	_build_ground_details()
	_nav_region.navigation_mesh = _make_navmesh()
	return {"nav_region": _nav_region, "map_data": _data}


# ============================================================================
#  Estruturas centrais (não espelhadas)
# ============================================================================
func _build_center() -> void:
	# Chão: uma colisão grande + malhas em blocos (melhor para luzes e culling).
	_props.collider(Vector3(0, -0.5, 0), Vector3(97, 1, 77))
	for ix in 8:
		for iz in 7:
			var c := Vector3(-48.5 + 97.0 / 8.0 * (ix + 0.5), -0.5, -38.5 + 77.0 / 7.0 * (iz + 0.5))
			_props.vbox(_detail, c, Vector3(97.0 / 8.0, 1.0, 77.0 / 7.0), _mat("asphalt"), 0.0, false)
	_props.ground_plane(Vector3(0, 0.012, 0), Vector2(24, 36), _mat("plaza"))
	_props.ground_plane(Vector3(0, 0.01, 20), Vector2(64, 4), _mat("sidewalk"))

	# Limites do mapa: fachadas de prédios (altas, fecham a visão).
	_box(Vector3(0, 6, -38.5), Vector3(98, 12, 1), _mat("boundary"))
	_box(Vector3(0, 6, 38.5), Vector3(98, 12, 1), _mat("boundary"))
	_box(Vector3(-48.5, 6, 0), Vector3(1, 12, 78), _mat("boundary"))
	_box(Vector3(48.5, 6, 0), Vector3(1, 12, 78), _mat("boundary"))

	# Praça: monumento central bloqueia a linha de visão do meio.
	_box(Vector3(0, 1.75, 0), Vector3(3.5, 3.5, 3.5), _mat("concrete"), true)
	_props.vbox(_detail, Vector3(0, 0.15, 0), Vector3(4.3, 0.3, 4.3), _mat("concrete"))
	_box(Vector3(0, 4.25, 0), Vector3(1.0, 1.5, 1.0), MapMaterials.get_material("metal", Color(0.45, 0.4, 0.3)))
	_car_at(Vector3(0, 0, -13), 0.0, Color(0.72, 0.7, 0.62))
	_box(Vector3(0, 0.6, 13), Vector3(5, 1.2, 0.4), _mat("jersey"), true)
	_crate(Vector3(0, 0, -27))
	_crate(Vector3(0.1, 0, -28.25))
	_props.road_line(Vector3(0, 0, -34), Vector3(0, 0, -22), 0.12, Color(0.85, 0.72, 0.2), 0.0)

	# Armazém (fachada norte e telhado são únicos; o interior é espelhado).
	_wall_x(22.0, -30.0 - WALL_T * 0.5, 30.0 + WALL_T * 0.5, 6.0, [
		[-24.0, 1.6, 0.0, 2.4], [-16.0, 2.0, 1.2, 2.4], [-8.0, 1.4, 0.0, 2.3],
		[0.0, 3.0, 0.0, 3.0],
		[8.0, 1.4, 0.0, 2.3], [16.0, 2.0, 1.2, 2.4], [24.0, 1.6, 0.0, 2.4]], _mat("warehouse"))
	_door_x(-8.0, 22.0, 1.4)
	_door_x(8.0, 22.0, 1.4)
	_roof(Vector3(0, 6.15, 30.1), Vector3(60.6, 0.3, 16.6), false)
	_props.ground_plane(Vector3(0, 0.02, 30.1), Vector2(60, 15.8), _mat("warehouse_floor"))
	_interior_probe(Vector3(0, 3.0, 30.1), Vector3(60, 6, 15.8))
	_shelf(Vector3(0, 0, 27), 9.0)
	_shelf(Vector3(0, 0, 32.5), 9.0)
	_pallets(Vector3(-5, 0, 35.5), 0.2, 2)
	_pallets(Vector3(5, 0, 24.5), -0.1, 2)
	for z in [25.0, 29.75, 34.5]:
		_props.hanging_lamp(Vector3(0, 5.2, z))
	_props.vbox(_detail, Vector3(0, 3.4, 21.8), Vector3(5, 0.8, 0.1), MapMaterials.emissive(Color(0.9, 0.9, 0.85), 0.3))

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

	# --- Zona de spawn (estacionamento) -----------------------------------
	for z in [-28.0, -20.0, -12.0, -4.0, 4.0, 12.0, 20.0, 28.0]:
		_data.add_spawn(_p(-43, 0, z), -PI * 0.5 * _m, team)
	_data.add_spawn(_p(-33, 0, -24), -PI * 0.5 * _m, -1)
	_data.add_spawn(_p(-33, 0, 20), -PI * 0.5 * _m, -1)
	var container := Color(0.3, 0.45, 0.58) if team == 0 else Color(0.62, 0.3, 0.22)
	_box(_p(-38, 1.3, -12), Vector3(2.5, 2.6, 6), MapMaterials.get_material("corrugated", container), true)
	_box(_p(-38, 1.3, 12), Vector3(2.5, 2.6, 6), MapMaterials.get_material("corrugated", container), true)
	_box(_p(-35, 0.55, 0), Vector3(0.6, 1.1, 3), _mat("jersey"), true)
	for z in range(-26, 30, 3):
		_props.road_line(_p(-47, 0, z), _p(-44.5, 0, z), 0.1, Color(0.85, 0.85, 0.8))
	_props.road_line(_p(-44.5, 0, -27), _p(-44.5, 0, 27), 0.1, Color(0.85, 0.85, 0.8))
	_props.car(_p(-45.6, 0, -16.5), PI * 0.5, Color(0.2, 0.2, 0.22))
	_add_cover_points(_p(-45.6, 0.65, -16.5), Vector3(1.85, 1.3, 4.4), 0.0)
	_props.car(_p(-45.6, 0, 16.5), PI * 0.5, Color(0.7, 0.7, 0.72))
	_add_cover_points(_p(-45.6, 0.65, 16.5), Vector3(1.85, 1.3, 4.4), 0.0)
	_props.lamp_post(_p(-40, 0, -4), -PI * 0.5 * _m)
	_props.lamp_post(_p(-40, 0, 24), -PI * 0.5 * _m)
	_props.electrical_box(_p(-47.6, 0, 4), 0.0)

	# --- Plataforma elevada + rampa (canto norte) --------------------------
	_box(_p(-28, 3.0, -35.25), Vector3(6, 0.4, 4.5), _mat("metal"))
	for c in [Vector2(-30.7, -37.2), Vector2(-25.3, -37.2), Vector2(-30.7, -33.3), Vector2(-25.3, -33.3)]:
		_box(_p(c.x, 1.4, c.y), Vector3(0.3, 2.8, 0.3), _mat("metal"))
	_box(_p(-25.1, 3.7, -35.25), Vector3(0.2, 1.0, 4.5), _mat("concrete"), true)
	_box(_p(-28, 3.7, -33.1), Vector3(6, 1.0, 0.2), _mat("concrete"), true)
	_ramp(_p(-39, 0, -35.25), _p(-31, 3.2, -35.25), 2.4)
	_locker(&"sniper", _p(-29.5, 3.2, -37.1), Color(0.3, 0.6, 1.0))

	# --- Rua Norte (longa distância) -------------------------------------
	_props.road_line(_p(-34, 0, -28.5), _p(-1, 0, -28.5), 0.14, Color(0.85, 0.85, 0.82), 3.0, 3.0)
	_props.road_line(_p(-34, 0, -35.8), _p(-1, 0, -35.8), 0.12, Color(0.85, 0.85, 0.82))
	_props.road_line(_p(-34, 0, -21.4), _p(-1, 0, -21.4), 0.12, Color(0.85, 0.85, 0.82))
	_car_at(_p(-21, 0, -28), 0.1, Color(0.5, 0.1, 0.08))
	_car_at(_p(-9, 0, -32), -0.35, Color(0.13, 0.2, 0.36))
	_props.cone(_p(-18, 0, -26.2))
	_props.cone(_p(-17.2, 0, -26.8))
	_box(_p(-15, 0.55, -23.5), Vector3(3, 1.1, 0.6), _mat("jersey"), true)
	_box(_p(-33, 0.55, -27), Vector3(0.6, 1.1, 3), _mat("jersey"), true)
	_crate(_p(-4.5, 0, -24.5))
	_box(_p(-27, 1.25, -22), Vector3(3, 2.5, 1.2), _mat("kiosk"), true)
	_props.vbox(_detail, _p(-27, 2.62, -22), Vector3(3.4, 0.12, 1.8), _mat("metal"))
	_props.lamp_post(_p(-22, 0, -20.6), PI)
	_props.lamp_post(_p(-8, 0, -36.8), 0.0)
	_props.hydrant(_p(-31, 0, -19.6))
	_props.trash_bin(_p(-12.6, 0, -19.4))

	# --- Prédio Norte (NO/NE): tijolo, 2 salas ----------------------------
	_props.ground_plane(_p(-21, 0.01, -13), Vector2(22, 14.4), _mat("sidewalk"))
	_building(-30, -12, -18, -8, 4.0,
		[[-26.0, 1.4, 0.0, 2.3], [-19.0, 2.0, 1.1, 2.1], [-15.0, 1.6, 0.0, 2.4]],
		[[-27.0, 2.0, 1.1, 2.1], [-24.0, 1.6, 0.0, 2.4], [-16.0, 2.0, 1.1, 2.1]],
		[[-13.0, 1.6, 0.0, 2.4]],
		[[-15.5, 2.0, 1.1, 2.1], [-11.0, 1.6, 0.0, 2.4]], _mat("wall_a"))
	_props.ground_plane(_p(-21, 0.02, -13), Vector2(17.7, 9.7), _mat("floor_wood"))
	_wall_z(-21.0, -18.0 + WALL_T * 0.5, -8.0 - WALL_T * 0.5, 4.0, [[-11.0, 1.4, 0.0, 2.3]], _mat("interior_a"))
	_door_x(-26.0, -18.0, 1.4)
	_box(_p(-26.5, 0.45, -12.5), Vector3(1.8, 0.9, 0.9), _mat("wood"), true)
	_box(_p(-14, 1.0, -17.4), Vector3(2.0, 2.0, 0.5), _mat("shelf"))
	_crate(_p(-17, 0, -10))
	_locker(&"ak47", _p(-29, 0.0, -9.0), Color(1.0, 0.55, 0.2))
	_props.ceiling_light(_p(-25.5, 3.95, -13), false)
	_props.ceiling_light(_p(-16.5, 3.95, -13), true, true)
	_props.ac_unit(_p(-26, 4.3, -15))
	_props.ac_unit(_p(-15, 4.3, -11))

	# --- Rua Central (média distância) ------------------------------------
	_props.box_truck(_p(-23.6, 0, 2.5), 0.0 if _m > 0.0 else PI, Color(0.75, 0.75, 0.72))
	_add_cover_points(_p(-24, 1.4, 2.5), Vector3(5.5, 2.8, 2.4), 0.0)
	_add_cover_points(_p(-20.3, 1.1, 2.5), Vector3(1.9, 2.2, 2.3), 0.0)
	_box(_p(-17, 0.55, -3.5), Vector3(3, 1.1, 0.6), _mat("jersey"), true)
	_crate(_p(-29, 0, -4.5))
	_box(_p(-29, 1.8, -4.5), Vector3(1.2, 1.2, 1.2), _mat("crate"))
	_box(_p(-13.5, 0.55, 4.5), Vector3(0.8, 1.1, 3), _mat("sandbag"), true)
	_props.road_line(_p(-34, 0, -0.1), _p(-14, 0, -0.1), 0.12, Color(0.85, 0.72, 0.2))
	_props.road_line(_p(-34, 0, 0.1), _p(-14, 0, 0.1), 0.12, Color(0.85, 0.72, 0.2))
	_props.crosswalk(_p(-12.8, 0, 0), 2.5, 8, false)
	_props.lamp_post(_p(-28, 0, -6.6), 0.0)
	_props.lamp_post(_p(-18, 0, 6.6), PI)
	_props.cone(_p(-26.5, 0, 4.2))

	# --- Praça (metade) ----------------------------------------------------
	_box(_p(-6, 0.55, -5), Vector3(3, 1.1, 1.2), _mat("planter"), true)
	_box(_p(-6, 0.55, 5), Vector3(3, 1.1, 1.2), _mat("planter"), true)
	_props.shrub(_p(-6, 1.15, -5), Vector3(2.8, 0.5, 1.0))
	_props.shrub(_p(-6, 1.15, 5), Vector3(2.8, 0.5, 1.0))
	_crate(_p(-9, 0, 0.5))
	_pallets(_p(-7, 0, -15), 0.0, 2)
	_crate(_p(-7, 0, 15.5))
	_props.tree(_p(-10, 0, -10.5))
	_props.tree(_p(-10, 0, 10.5), 0.9)
	_props.bench(_p(-3.5, 0, -8.2), 0.0)
	_props.bench(_p(-3.5, 0, 8.2), PI)
	_props.trash_bin(_p(-2, 0, -8.4))
	_props.lamp_post(_p(-11, 0, -7), -PI * 0.5 * _m)
	_props.lamp_post(_p(-11, 0, 7), -PI * 0.5 * _m)

	# --- Prédio Sul (SO/SE): reboco, 3 salas -------------------------------
	_props.ground_plane(_p(-21, 0.01, 13), Vector2(22, 14), _mat("sidewalk"))
	_building(-30, -12, 8, 18, 4.0,
		[[-27.0, 1.6, 0.0, 2.4], [-21.0, 2.0, 1.1, 2.1], [-15.0, 1.4, 0.0, 2.3]],
		[[-27.0, 2.0, 1.1, 2.1], [-21.0, 1.6, 0.0, 2.4], [-15.0, 2.0, 1.1, 2.1]],
		[[13.0, 2.0, 1.1, 2.1]],
		[[11.0, 1.6, 0.0, 2.4], [15.0, 2.0, 1.1, 2.1]], _mat("wall_b"))
	_props.ground_plane(_p(-21, 0.02, 13), Vector2(17.7, 9.7), _mat("floor_tiles"))
	_wall_z(-24.0, 8.0 + WALL_T * 0.5, 18.0 - WALL_T * 0.5, 4.0, [[15.0, 1.4, 0.0, 2.3]], _mat("interior_a"))
	_wall_z(-18.0, 8.0 + WALL_T * 0.5, 18.0 - WALL_T * 0.5, 4.0, [[11.0, 1.4, 0.0, 2.3]], _mat("interior_a"))
	_door_x(-15.0, 8.0, 1.4)
	_crate(_p(-26.5, 0, 16.5))
	_crate(_p(-15, 0, 16.3))
	_box(_p(-21, 0.45, 12), Vector3(1.6, 0.9, 1.6), _mat("wood"), true)
	_props.ceiling_light(_p(-27, 3.95, 13), true)
	_props.ceiling_light(_p(-21, 3.95, 13), false)
	_props.ceiling_light(_p(-15, 3.95, 13), true)
	_props.ac_unit(_p(-20, 4.3, 16))
	_props.trash_bin(_p(-28.8, 0, 7.3))
	_props.hydrant(_p(-12.6, 0, 7.4))

	# --- Beco sul (rota de flanco) -----------------------------------------
	_crate(_p(-33, 0, 20))
	_props.barrel(_p(-8, 0, 20), Color(0.25, 0.35, 0.5))
	_props.barrel(_p(-8.7, 0, 20.5), Color(0.55, 0.2, 0.15))
	_add_cover_points(_p(-8.3, 0.6, 20.2), Vector3(1.4, 1.2, 1.2), 0.0)
	var d_size := _props.dumpster(_p(-19, 0, 20.3), 0.0)
	_add_cover_points(_p(-19, 0.68, 20.3), d_size, 0.0)
	_props.lamp_post(_p(-26, 0, 21.4), PI)

	# --- Armazém (curta distância) -----------------------------------------
	_wall_z(-30.0, 22.0 + WALL_T * 0.5, 38.0, 6.0, [[29.0, 2.4, 0.0, 3.0]], _mat("warehouse"))
	_wall_z(-12.0, 22.0 + WALL_T * 0.5, 38.0, 6.0, [[25.5, 1.4, 0.0, 2.3], [34.0, 1.6, 0.0, 2.4]], _mat("warehouse"))
	_wall_x(30.0, -30.0 + WALL_T * 0.5, -12.0 - WALL_T * 0.5, 6.0, [[-21.0, 1.6, 0.0, 2.4], [-26.0, 2.0, 1.1, 2.1]], _mat("warehouse"))
	_door_z(-12.0, 25.5, 1.4)
	_crate(_p(-16, 0, 26))
	_crate(_p(-25, 0, 35.5))
	_pallets(_p(-16, 0, 34.5), 0.15, 3)
	_props.barrel(_p(-29, 0, 31), Color(0.3, 0.4, 0.3))
	_props.barrel(_p(-29, 0, 31.7), Color(0.3, 0.4, 0.3))
	_locker(&"shotgun", _p(-28.5, 0.0, 23.0), Color(0.9, 0.25, 0.25))
	_props.ceiling_light(_p(-21, 5.95, 26), true, true)
	_props.ceiling_light(_p(-21, 5.95, 34), true)

	# --- Pontos de patrulha -------------------------------------------------
	for p in [Vector3(-41, 0, -30), Vector3(-41, 0, 0), Vector3(-41, 0, 30), Vector3(-28, 3.2, -35.2),
			Vector3(-21, 0, -25), Vector3(-9, 0, -27), Vector3(-25, 0, -13), Vector3(-16, 0, -13),
			Vector3(-24, 0, -2), Vector3(-15, 0, 1), Vector3(-8, 0, -6), Vector3(-8, 0, 6),
			Vector3(-27, 0, 13), Vector3(-21, 0, 14), Vector3(-15, 0, 13), Vector3(-20, 0, 20),
			Vector3(-24, 0, 26), Vector3(-24, 0, 34), Vector3(-16, 0, 28), Vector3(-6, 0, 30),
			Vector3(-34, 0, -30), Vector3(-34, 0, 26)]:
		_data.patrol_points.append(_p(p.x, p.y, p.z))


## Prédios de fundo em volta do mapa (sem colisão): dão sensação de cidade.
func _build_skyline() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 99
	var tints := [Color(0.95, 0.92, 0.86), Color(0.8, 0.82, 0.85), Color(0.9, 0.8, 0.7), Color(0.7, 0.72, 0.7)]
	for x in range(-54, 60, 12):
		for z in [-46.0, 46.0]:
			var h := rng.randf_range(14.0, 32.0)
			_props.skyline_building(Vector2(x, z), Vector3(11.5, h, 12), tints[rng.randi() % tints.size()])
	for z in range(-36, 40, 12):
		for x in [-56.0, 56.0]:
			var h2 := rng.randf_range(14.0, 30.0)
			_props.skyline_building(Vector2(x, z), Vector3(12, h2, 11.5), tints[rng.randi() % tints.size()])


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
	for o in openings:
		var c := _p(o[0], 0.0, z)
		_props.opening_frame(Vector2(c.x, c.z), true, o[1], o[2], o[3], WALL_T)
	for n in [Vector3.BACK, Vector3.FORWARD]:
		_decals.wall_grime(_p(x0, 0.0, z), _p(x1, 0.0, z), n)


## Parede ao longo do eixo Z em x fixo (espelhada).
func _wall_z(x: float, z0: float, z1: float, h: float, openings: Array, mat: Material) -> void:
	for seg in _wall_segments(minf(z0, z1), maxf(z0, z1), h, openings):
		var cz: float = (seg[0] + seg[1]) * 0.5
		_box(_p(x, (seg[2] + seg[3]) * 0.5, cz), Vector3(WALL_T, seg[3] - seg[2], seg[1] - seg[0]), mat)
	for o in openings:
		var c := _p(x, 0.0, o[0])
		_props.opening_frame(Vector2(c.x, c.z), false, o[1], o[2], o[3], WALL_T)
	for n in [Vector3.RIGHT, Vector3.LEFT]:
		_decals.wall_grime(_p(x, 0.0, z0), _p(x, 0.0, z1), n)


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
	# Calhas nos cantos, meio-fio da calçada e sonda de reflexo interna.
	for cx in [x0 - 0.25, x1 + 0.25]:
		for cz in [z0 - 0.25, z1 + 0.25]:
			_props.drain_pipe(_p(cx, 0.0, cz), h + 0.3)
	_props.curb_rect(_p((x0 + x1) * 0.5, 0.0, (z0 + z1) * 0.5), Vector2(absf(x1 - x0) + 4.0, absf(z1 - z0) + 4.4))
	_interior_probe(_p((x0 + x1) * 0.5, h * 0.5, (z0 + z1) * 0.5), Vector3(absf(x1 - x0), h, absf(z1 - z0)))


func _roof(center: Vector3, size: Vector3, parapet := true) -> void:
	_box(center, size, _mat("roof"), false, 0.0, _roofs)
	if parapet:
		_props.roof_parapet(center, size)


func _ramp(bottom: Vector3, top: Vector3, width: float) -> void:
	var dir := top - bottom
	var forward := dir.normalized()
	var side := forward.cross(Vector3.UP).normalized()
	var up := side.cross(forward).normalized()
	var thickness := 0.3
	var body := _box(Vector3.ZERO, Vector3(width, thickness, dir.length()), _mat("metal"))
	body.transform = Transform3D(Basis(-side, up, forward), (bottom + top) * 0.5 - up * thickness * 0.5)


## Carro com colisão e pontos de cobertura.
func _car_at(center: Vector3, rot_y: float, color: Color) -> void:
	var r := rot_y * _m
	var size := _props.car(center, r, color)
	_add_cover_points(center + Vector3(0, size.y * 0.5, 0), size, r)


## Caixote de madeira 1,2 m (cobertura).
func _crate(base: Vector3, size := 1.2) -> void:
	var c := base + Vector3(0, size * 0.5, 0)
	_box(c, Vector3.ONE * size, _mat("crate"), true)
	# Ripas escuras nas bordas (dá leitura de "caixote").
	var trim := MapMaterials.get_material("wood", Color(0.55, 0.45, 0.35))
	for y in [0.06, size - 0.06]:
		_props.vbox(_detail, base + Vector3(0, y, 0), Vector3(size + 0.02, 0.1, size + 0.02), trim)


func _pallets(base: Vector3, yaw: float, layers: int) -> void:
	var size := _props.pallet_stack(base, yaw * _m, layers)
	_add_cover_points(base + Vector3(0, size.y * 0.5, 0), size, yaw * _m)


## Estante de metal com caixas (cobertura alta).
func _shelf(base: Vector3, length: float) -> void:
	var h := 2.4
	_props.collider(base + Vector3(0, h * 0.5, 0), Vector3(length, h, 1.0))
	_add_cover_points(base + Vector3(0, h * 0.5, 0), Vector3(length, h, 1.0), 0.0)
	var frame := MapMaterials.get_material("metal", Color(0.25, 0.4, 0.65))
	var beam := MapMaterials.get_material("metal", Color(0.85, 0.5, 0.15))
	var card := MapMaterials.get_material("cardboard")
	var posts := int(length / 2.2) + 1
	for i in posts:
		var x := -length * 0.5 + length * float(i) / float(posts - 1)
		for z in [-0.45, 0.45]:
			_props.vbox(_detail, base + Vector3(x, h * 0.5, z), Vector3(0.08, h, 0.08), frame)
	for y in [0.15, 1.2, 2.3]:
		for z in [-0.45, 0.45]:
			_props.vbox(_detail, base + Vector3(0, y, z), Vector3(length, 0.1, 0.06), beam)
		_props.vbox(_detail, base + Vector3(0, y + 0.06, 0), Vector3(length, 0.03, 0.95), frame)
	# Prateleiras cheias (o meio é bloqueado por caixas).
	for level in [0.2, 1.25]:
		var x2 := -length * 0.5 + 0.4
		while x2 < length * 0.5 - 0.4:
			var bw := randf_range(0.5, 0.8)
			var bh := randf_range(0.5, 0.9)
			_props.vbox(_detail, base + Vector3(x2 + bw * 0.5, level + bh * 0.5 + 0.05, 0), Vector3(bw, bh, 0.85), card)
			x2 += bw + 0.05


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


## Reflexos corretos dentro de prédios (sem refletir o céu).
func _interior_probe(center: Vector3, size: Vector3) -> void:
	var probe := ReflectionProbe.new()
	probe.position = center
	probe.size = size + Vector3(0.2, 0.2, 0.2)
	probe.interior = true
	probe.box_projection = true
	probe.update_mode = ReflectionProbe.UPDATE_ONCE
	probe.ambient_mode = ReflectionProbe.AMBIENT_ENVIRONMENT
	probe.cull_mask = 0xFFFFF & ~DecalBuilder.EXCLUDE_MASK
	_detail.add_child(probe)


## Poças, manchas, rachaduras, bueiros e lixo espalhado.
func _build_ground_details() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 4242
	# Zonas de rua (asfalto): [centro_x, centro_z, meia_largura, meia_profundidade]
	var streets := [[0.0, -29.0, 34.0, 7.0], [-23.0, 0.0, 10.0, 6.0], [23.0, 0.0, 10.0, 6.0],
		[-41.0, 0.0, 6.0, 30.0], [41.0, 0.0, 6.0, 30.0], [0.0, 20.0, 30.0, 1.6]]
	for i in 26:
		var z: Array = streets[rng.randi() % streets.size()]
		var p := Vector3(z[0] + rng.randf_range(-z[2], z[2]), 0.0, z[1] + rng.randf_range(-z[3], z[3]))
		match i % 4:
			0, 1:
				_decals.puddle(p, rng.randf_range(1.2, 3.2))
			2:
				_decals.stain(p, rng.randf_range(0.8, 1.8), true)
			3:
				_decals.crack(p, rng.randf_range(1.5, 3.0))
	for mp in [Vector3(-18, 0, -30), Vector3(18, 0, -30), Vector3(-30, 0, 1.5), Vector3(30, 0, -1.5),
			Vector3(-41, 0, 8), Vector3(41, 0, -8), Vector3(4, 0, -34)]:
		_decals.manhole(mp)
	# Manchas no chão dos prédios e do armazém.
	for sp in [Vector3(-25, 0, -12), Vector3(24, 0, -14), Vector3(-15, 0, 14), Vector3(20, 0, 12),
			Vector3(-20, 0, 27), Vector3(18, 0, 33), Vector3(-3, 0, 30), Vector3(6, 0, 28)]:
		_decals.stain(sp, rng.randf_range(1.0, 2.2), sp.z > 22.0)
	# Lixo, papéis e folhas (MultiMesh = 1 chamada de desenho).
	_props.litter(rng, [[0.0, -29.0, 34.0, 7.0], [0.0, 0.0, 11.0, 17.0], [-23.0, 0.0, 10.0, 6.0],
		[23.0, 0.0, 10.0, 6.0], [0.0, 20.0, 30.0, 1.6], [-41.0, 0.0, 6.0, 30.0], [41.0, 0.0, 6.0, 30.0]], 700)
	# Placas.
	_props.street_sign(Vector3(-12.6, 0, -7.6), "PARE")
	_props.street_sign(Vector3(12.6, 0, 7.6), "PARE")
	_props.street_sign(Vector3(-33.6, 0, -21), "DISTRITO 7")
	_props.street_sign(Vector3(33.6, 0, -21), "DISTRITO 7")


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
#  Materiais (ver map/map_materials.gd)
# ============================================================================
func _mat(key: String) -> StandardMaterial3D:
	var def: Array = MATERIALS.get(key, ["concrete", Color.WHITE])
	return MapMaterials.get_material(def[0], def[1])
