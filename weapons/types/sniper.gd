class_name Sniper
extends Weapon
## Rifle de precisão por ferrolho. Alto dano, disparo lento, precisão total
## com a luneta (ads_spread = 0) e péssimo sem mirar. Recuo forte com
## recuperação lenta (recoil_recovery baixo no config).
## Ao mirar, o modelo some e a HUD mostra a luneta óptica.

const SCOPE_THRESHOLD := 0.85


func _init() -> void:
	weapon_id = &"sniper"


func is_scoped() -> bool:
	return ads_amount >= SCOPE_THRESHOLD and state != State.RELOADING


func _on_fired() -> void:
	_action_anim = 1.0
	if data.sound_action != "":
		get_tree().create_timer(0.35).timeout.connect(
			func(): AudioManager.play_2d(data.sound_action, -5.0))


func visual_tick(delta: float, ctx: WeaponContext) -> void:
	super(delta, ctx)
	# Esconde o modelo quando olhando pela luneta.
	_model.visible = not is_scoped()


func _animate_parts(_delta: float) -> void:
	var bolt: Node3D = _parts.get("bolt")
	if bolt == null:
		return
	# Movimento do ferrolho: gira e puxa para trás.
	var t := sin(clampf((1.0 - _action_anim) * 1.4, 0.0, 1.0) * PI) if _action_anim > 0.0 else 0.0
	bolt.rotation.z = t * deg_to_rad(70.0)
	bolt.position.z = 0.1 + t * 0.06
