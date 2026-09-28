class_name Ballistics
extends RefCounted
## Sistema de tiro "hitscan" compartilhado entre jogador e bots.
## Um raio sai da origem na direção dada; se acertar uma Hitbox aplica dano
## (com queda por distância), senão gera um impacto no cenário.


## Dispara um projétil. Retorna { "position": Vector3, "hit": bool, "killed": bool }.
static func fire_ray(shooter: Node3D, origin: Vector3, direction: Vector3,
		data: WeaponData, exclude: Array[RID], damage_multiplier := 1.0) -> Dictionary:
	var space := shooter.get_world_3d().direct_space_state
	var to := origin + direction * data.max_range
	var query := PhysicsRayQueryParameters3D.create(origin, to, Layers.SHOT_MASK, exclude)
	query.collide_with_areas = true
	query.collide_with_bodies = true
	var hit := space.intersect_ray(query)
	if hit.is_empty():
		return {"position": to, "hit": false, "killed": false}
	var point: Vector3 = hit.position
	var normal: Vector3 = hit.normal
	var collider: Object = hit.collider
	if collider is Hitbox:
		var damage := data.damage_at_distance(origin.distance_to(point)) * damage_multiplier
		var result: Dictionary = (collider as Hitbox).apply_hit(damage, shooter, data.display_name)
		if result.applied:
			Events.bullet_impact.emit(point, normal if normal != Vector3.ZERO else -direction, &"flesh")
		return {"position": point, "hit": result.applied, "killed": result.killed}
	Events.bullet_impact.emit(point, normal, &"world")
	return {"position": point, "hit": false, "killed": false}


## Direção aleatória dentro de um cone (dispersão) em volta do -Z da base.
static func spread_direction(aim_basis: Basis, spread_degrees: float) -> Vector3:
	if spread_degrees <= 0.001:
		return -aim_basis.z.normalized()
	# sqrt() distribui os tiros de forma uniforme dentro do círculo.
	var angle := deg_to_rad(spread_degrees) * sqrt(randf())
	var theta := randf() * TAU
	var local := Vector3(sin(angle) * cos(theta), sin(angle) * sin(theta), -cos(angle))
	return (aim_basis * local).normalized()


## Cria uma base "olhando" na direção dada (para bots).
static func basis_from_direction(direction: Vector3) -> Basis:
	var up := Vector3.UP if absf(direction.normalized().y) < 0.98 else Vector3.FORWARD
	return Basis.looking_at(direction, up)
