class_name MapData
extends RefCounted
## Informações do mapa que a IA e o sistema de spawn usam:
## pontos de spawn, de patrulha e de cobertura (já "encaixados" na navmesh).

## Cada spawn: { "position": Vector3, "yaw": float, "team": int (-1 = neutro) }
var spawn_points: Array[Dictionary] = []
var patrol_points: PackedVector3Array = PackedVector3Array()
var cover_points: PackedVector3Array = PackedVector3Array()
var navigation_map: RID


func add_spawn(pos: Vector3, yaw: float, team: int) -> void:
	spawn_points.append({"position": pos, "yaw": yaw, "team": team})


## Depois da navmesh pronta: encaixa pontos nela e descarta os inválidos.
func finalize(nav_map: RID) -> void:
	navigation_map = nav_map
	patrol_points = _snap_all(patrol_points, 1.5)
	cover_points = _snap_all(cover_points, 0.6)


func snap(p: Vector3) -> Vector3:
	return NavigationServer3D.map_get_closest_point(navigation_map, p)


## Ponto aleatório da navmesh perto de "center".
func random_point_near(center: Vector3, radius: float) -> Vector3:
	var a := randf() * TAU
	var r := radius * sqrt(randf())
	return snap(center + Vector3(cos(a) * r, 0.0, sin(a) * r))


func _snap_all(points: PackedVector3Array, max_error: float) -> PackedVector3Array:
	var out := PackedVector3Array()
	for p in points:
		var s := snap(p)
		if Vector2(s.x - p.x, s.z - p.z).length() <= max_error and absf(s.y - p.y) < 1.0:
			out.append(s)
	return out
