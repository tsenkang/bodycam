class_name WeaponLocker
extends StaticBody3D
## Armário de armas: desbloqueia uma arma nova ou reabastece a munição.
## Interação com a tecla E. Tem tempo de recarga para reabastecer.

const REFILL_COOLDOWN := 20.0

var weapon_id: StringName
var _ready_at := 0.0


func setup(id: StringName, color: Color) -> void:
	weapon_id = id
	collision_layer = Layers.WORLD
	collision_mask = 0
	var size := Vector3(1.1, 1.2, 0.5)
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.18, 0.22, 0.18)
	mi.material_override = m
	mi.position.y = size.y * 0.5
	add_child(mi)
	var stripe := MeshInstance3D.new()
	var sb := BoxMesh.new()
	sb.size = Vector3(1.0, 0.08, 0.52)
	stripe.mesh = sb
	var sm := StandardMaterial3D.new()
	sm.albedo_color = color
	sm.emission_enabled = true
	sm.emission = color
	sm.emission_energy_multiplier = 0.6
	stripe.material_override = sm
	stripe.position.y = 1.0
	add_child(stripe)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	cs.position.y = size.y * 0.5
	add_child(cs)
	var label := Label3D.new()
	label.text = WeaponConfig.WEAPONS[id].display_name
	label.font_size = 40
	label.pixel_size = 0.004
	label.outline_size = 8
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.position.y = 1.55
	add_child(label)


func _now() -> float:
	return Time.get_ticks_msec() / 1000.0


func get_interaction_text(actor: Node) -> String:
	if not actor.has_method("get_inventory"):
		return ""
	var inv: Inventory = actor.get_inventory()
	var name_text: String = WeaponConfig.WEAPONS[weapon_id].display_name
	if not inv.has_weapon(weapon_id):
		return "[E] Pegar %s" % name_text
	var wait := _ready_at - _now()
	if wait > 0.0:
		return "Munição disponível em %ds" % ceili(wait)
	return "[E] Reabastecer munição"


func interact(actor: Node3D) -> void:
	if not actor.has_method("get_inventory"):
		return
	var inv: Inventory = actor.get_inventory()
	var name_text: String = WeaponConfig.WEAPONS[weapon_id].display_name
	if not inv.has_weapon(weapon_id):
		var w := inv.add_weapon(weapon_id)
		if w and actor.get("weapon_manager"):
			actor.weapon_manager.select_slot(w.data.slot)
		AudioManager.play_2d("pickup")
		Events.hud_message.emit("%s desbloqueada  [%d]" % [name_text, w.data.slot])
	elif _now() >= _ready_at:
		inv.refill_all()
		_ready_at = _now() + REFILL_COOLDOWN
		AudioManager.play_2d("pickup")
		Events.hud_message.emit("Munição reabastecida")
