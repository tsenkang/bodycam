class_name SpawnManager
extends Node
## Escolhe pontos de spawn seguros e agenda renascimentos.
## Funciona igual para bots e para o jogador:
##   1. espera alguns segundos
##   2. escolhe um spawn válido
##   3. evita pontos perto de inimigos (e à vista deles)
##   4. reaparece o personagem, que volta ao combate

var map_data: MapData


func setup(p_map: MapData) -> void:
	map_data = p_map


## Spawn inicial: pontos do lado da equipe, em ordem.
func get_initial_spawn(team: int, index: int) -> Transform3D:
	var own: Array[Dictionary] = []
	for s in map_data.spawn_points:
		if s.team == team:
			own.append(s)
	var s: Dictionary = own[index % own.size()]
	var offset := Vector3(0.0, 0.0, 1.6) * floorf(float(index) / own.size())  # se faltar ponto
	return _xform(s.position + offset, s.yaw)


## Melhor spawn para renascer.
func find_spawn(team: int) -> Transform3D:
	var enemies: Array = []
	var friends: Array = []
	for a in get_tree().get_nodes_in_group("combatants"):
		if not a.is_alive():
			continue
		(friends if a.team == team else enemies).append(a)
	var space := get_viewport().world_3d.direct_space_state
	var scored: Array = []
	for s in map_data.spawn_points:
		var pos: Vector3 = s.position
		var min_enemy := INF
		for e in enemies:
			min_enemy = minf(min_enemy, pos.distance_to(e.global_position))
		var score := 0.0
		if min_enemy < GameConfig.spawn_safe_distance:
			score -= 1000.0 - min_enemy  # inválido (usado só se não houver outro)
		score += minf(min_enemy, 40.0) * 0.5
		# Penaliza pontos à vista de inimigos.
		for e in enemies:
			if pos.distance_to(e.global_position) < 45.0:
				var q := PhysicsRayQueryParameters3D.create(pos + Vector3.UP * 1.6, e.get_eye_position(), Layers.WORLD)
				if space.intersect_ray(q).is_empty():
					score -= 25.0
		# Prefere o próprio lado e perto de aliados.
		if s.team == team:
			score += 12.0
		elif s.team != -1:
			score -= 20.0
		for f in friends:
			if pos.distance_to(f.global_position) < 20.0:
				score += 3.0
		score += randf() * 8.0
		scored.append([score, s])
	scored.sort_custom(func(a, b): return a[0] > b[0])
	var chosen: Dictionary = scored[0][1]
	return _xform(chosen.position, chosen.yaw)


func schedule_respawn(actor: Node, delay: float) -> void:
	get_tree().create_timer(delay, false).timeout.connect(func():
		if is_instance_valid(actor) and not actor.is_alive():
			actor.respawn(find_spawn(actor.team)))


func _xform(pos: Vector3, yaw: float) -> Transform3D:
	return Transform3D(Basis(Vector3.UP, yaw), pos + Vector3.UP * 0.05)
