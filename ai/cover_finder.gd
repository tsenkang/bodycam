class_name CoverFinder
extends RefCounted
## Escolhe um ponto de cobertura escondido de uma ameaça.
## Os pontos vêm do mapa (MapData.cover_points), gerados ao redor de caixas,
## carros, barreiras etc.

const MAX_CANDIDATES := 10
const CROUCH_EYE := 1.0


## Retorna o ponto escolhido ou null.
static func find(bot: Node3D, map_data: MapData, threat: Vector3, max_distance := 16.0) -> Variant:
	var origin := bot.global_position
	var candidates: Array = []
	for p in map_data.cover_points:
		var d := origin.distance_to(p)
		if d > max_distance or d < 1.0:
			continue
		# Não correr em direção à ameaça: o ponto deve estar longe dela.
		if p.distance_to(threat) < 5.0:
			continue
		candidates.append([d, p])
	candidates.sort_custom(func(a, b): return a[0] < b[0])
	var space := bot.get_world_3d().direct_space_state
	var checked := 0
	var valid: Array[Vector3] = []
	for c in candidates:
		if checked >= MAX_CANDIDATES or valid.size() >= 3:
			break
		checked += 1
		var p: Vector3 = c[1]
		if _is_occupied(bot, p):
			continue
		# Escondido = a linha entre o olho (agachado) e a ameaça é bloqueada.
		var q := PhysicsRayQueryParameters3D.create(p + Vector3.UP * CROUCH_EYE, threat + Vector3.UP * 1.3, Layers.WORLD)
		if not space.intersect_ray(q).is_empty():
			valid.append(p)
	if valid.is_empty():
		return null
	return valid.pick_random()


static func _is_occupied(bot: Node3D, p: Vector3) -> bool:
	for other in bot.get_tree().get_nodes_in_group("bots"):
		if other != bot and other.is_alive() and other.global_position.distance_squared_to(p) < 1.2:
			return true
	return false
