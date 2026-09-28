class_name HUD
extends CanvasLayer
## HUD minimalista (estilo bodycam): quase tudo pequeno e nos cantos.
##  - canto inferior direito: arma, munição e reserva
##  - canto inferior esquerdo: vida
##  - centro: mira dinâmica, hitmarker, indicador de interação
##  - topo: placar e tempo (pequenos) / feed de abates (direita)
##  - canto superior esquerdo: "● REC" (opcional)
## Atualiza por SINAIS; só a mira e a luneta são checadas por frame.

var player: Player
var match_manager: MatchManager

var _root: Control
var _crosshair: Crosshair
var _weapon_label: Label
var _mag_label: Label
var _reserve_label: Label
var _status_label: Label
var _reload_bar: ColorRect
var _reload_bg: ColorRect
var _health_fill: ColorRect
var _health_label: Label
var _score_label: Label
var _time_label: Label
var _feed: VBoxContainer
var _prompt_label: Label
var _message_label: Label
var _rec_label: Label
var _death_label: Label
var _damage_vignette: TextureRect
var _scope: ColorRect
var _slots_label: Label

var _damage_flash := 0.0
var _message_time := 0.0
var _rec_start := 0.0
var _rec_second := -1
var _death_time := 0.0
var _death_killer := ""


func _ready() -> void:
	layer = 5
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)
	_build()
	_rec_start = Time.get_ticks_msec() / 1000.0
	Events.hit_confirmed.connect(_on_hit_confirmed)
	Events.interaction_prompt.connect(_on_prompt)
	Events.hud_message.connect(show_message)


func bind(p_player: Player, p_match: MatchManager) -> void:
	player = p_player
	match_manager = p_match
	player.health.health_changed.connect(_on_health_changed)
	player.health.damaged.connect(_on_player_damaged)
	player.weapon_manager.weapon_changed.connect(_on_weapon_changed)
	player.weapon_manager.ammo_changed.connect(_on_ammo_changed)
	player.inventory.weapon_added.connect(func(_w): _update_slots())
	player.died.connect(_on_player_died)
	player.respawned.connect(_on_player_respawned)
	match_manager.score_changed.connect(_on_score_changed)
	match_manager.time_changed.connect(_on_time_changed)
	match_manager.kill_feed.connect(_on_kill_feed)
	_on_health_changed(player.health.current, player.health.max_health)
	if player.weapon_manager.current:
		_on_weapon_changed(player.weapon_manager.current)
	_update_slots()


# ============================================================================
#  Construção
# ============================================================================
func _build() -> void:
	# Vinheta de dano (bordas avermelhadas, sem sangue).
	_damage_vignette = TextureRect.new()
	var grad := Gradient.new()
	grad.set_color(0, Color(0.6, 0.0, 0.0, 0.0))
	grad.set_color(1, Color(0.6, 0.0, 0.0, 0.85))
	grad.set_offset(0, 0.55)
	var gt := GradientTexture2D.new()
	gt.gradient = grad
	gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5)
	gt.fill_to = Vector2(1.0, 1.0)
	_damage_vignette.texture = gt
	_damage_vignette.set_anchors_preset(Control.PRESET_FULL_RECT)
	_damage_vignette.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_damage_vignette.stretch_mode = TextureRect.STRETCH_SCALE
	_damage_vignette.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_damage_vignette.modulate.a = 0.0
	_root.add_child(_damage_vignette)

	# Luneta.
	_scope = ColorRect.new()
	_scope.set_anchors_preset(Control.PRESET_FULL_RECT)
	_scope.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sm := ShaderMaterial.new()
	sm.shader = load("res://shaders/scope.gdshader")
	_scope.material = sm
	_scope.visible = false
	_root.add_child(_scope)

	_crosshair = Crosshair.new()
	_crosshair.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.add_child(_crosshair)

	# --- Munição (inferior direito) --------------------------------------
	var ammo_box := VBoxContainer.new()
	ammo_box.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	ammo_box.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	ammo_box.grow_vertical = Control.GROW_DIRECTION_BEGIN
	ammo_box.offset_right = -28
	ammo_box.offset_bottom = -22
	ammo_box.alignment = BoxContainer.ALIGNMENT_END
	ammo_box.add_theme_constant_override("separation", 0)
	_root.add_child(ammo_box)
	_slots_label = _label("", 11, Color(1, 1, 1, 0.35), HORIZONTAL_ALIGNMENT_RIGHT)
	ammo_box.add_child(_slots_label)
	_weapon_label = _label("", 13, Color(1, 1, 1, 0.7), HORIZONTAL_ALIGNMENT_RIGHT)
	ammo_box.add_child(_weapon_label)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_END
	row.add_theme_constant_override("separation", 6)
	ammo_box.add_child(row)
	_mag_label = _label("30", 30, Color.WHITE, HORIZONTAL_ALIGNMENT_RIGHT)
	row.add_child(_mag_label)
	_reserve_label = _label("/ 120", 15, Color(1, 1, 1, 0.55), HORIZONTAL_ALIGNMENT_LEFT)
	_reserve_label.size_flags_vertical = Control.SIZE_SHRINK_END
	row.add_child(_reserve_label)
	_reload_bg = ColorRect.new()
	_reload_bg.color = Color(1, 1, 1, 0.15)
	_reload_bg.custom_minimum_size = Vector2(110, 2)
	_reload_bg.size_flags_horizontal = Control.SIZE_SHRINK_END
	_reload_bg.visible = false
	ammo_box.add_child(_reload_bg)
	_reload_bar = ColorRect.new()
	_reload_bar.color = Color(1, 1, 1, 0.8)
	_reload_bar.size = Vector2(0, 2)
	_reload_bg.add_child(_reload_bar)
	_status_label = _label("", 11, Color(1, 0.85, 0.5, 0.85), HORIZONTAL_ALIGNMENT_RIGHT)
	ammo_box.add_child(_status_label)

	# --- Vida (inferior esquerdo) ----------------------------------------
	var hp_box := VBoxContainer.new()
	hp_box.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	hp_box.grow_vertical = Control.GROW_DIRECTION_BEGIN
	hp_box.offset_left = 28
	hp_box.offset_bottom = -26
	hp_box.add_theme_constant_override("separation", 3)
	_root.add_child(hp_box)
	_health_label = _label("100", 13, Color(1, 1, 1, 0.75))
	hp_box.add_child(_health_label)
	var hp_bg := ColorRect.new()
	hp_bg.color = Color(1, 1, 1, 0.15)
	hp_bg.custom_minimum_size = Vector2(170, 4)
	hp_box.add_child(hp_bg)
	_health_fill = ColorRect.new()
	_health_fill.color = Color(0.92, 0.94, 0.95, 0.9)
	_health_fill.size = Vector2(170, 4)
	hp_bg.add_child(_health_fill)

	# --- Placar e tempo (topo) -------------------------------------------
	var top := VBoxContainer.new()
	top.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	top.grow_horizontal = Control.GROW_DIRECTION_BOTH
	top.offset_top = 14
	top.add_theme_constant_override("separation", 0)
	_root.add_child(top)
	_score_label = _label("", 15, Color(1, 1, 1, 0.85), HORIZONTAL_ALIGNMENT_CENTER)
	top.add_child(_score_label)
	_time_label = _label("", 12, Color(1, 1, 1, 0.55), HORIZONTAL_ALIGNMENT_CENTER)
	top.add_child(_time_label)

	# --- Feed de abates (superior direito) -------------------------------
	_feed = VBoxContainer.new()
	_feed.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	_feed.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	_feed.offset_right = -24
	_feed.offset_top = 18
	_feed.alignment = BoxContainer.ALIGNMENT_BEGIN
	_root.add_child(_feed)

	# --- REC (superior esquerdo) -----------------------------------------
	_rec_label = _label("", 13, Color(1, 1, 1, 0.8))
	_rec_label.position = Vector2(26, 18)
	_rec_label.visible = GameConfig.show_rec_overlay
	_root.add_child(_rec_label)

	# --- Centro: interação, mensagens, morte -----------------------------
	_prompt_label = _center_label(14, 64)
	_message_label = _center_label(16, -140)
	_death_label = _center_label(20, -40)


func _label(text: String, size: int, color: Color, align := HORIZONTAL_ALIGNMENT_LEFT) -> Label:
	var l := Label.new()
	l.text = text
	l.horizontal_alignment = align
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.6))
	l.add_theme_constant_override("outline_size", 4)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


func _center_label(size: int, y_offset: float) -> Label:
	var l := _label("", size, Color(1, 1, 1, 0.9), HORIZONTAL_ALIGNMENT_CENTER)
	l.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	l.grow_horizontal = Control.GROW_DIRECTION_BOTH
	l.offset_left = -400
	l.offset_right = 400
	l.offset_top = y_offset
	l.offset_bottom = y_offset + 60
	_root.add_child(l)
	return l


# ============================================================================
#  Atualização por frame (leve)
# ============================================================================
func _process(delta: float) -> void:
	if player == null:
		return
	var wm := player.weapon_manager
	var w := wm.current
	var alive := player.is_alive()

	# Mira: abre com a dispersão; vira ponto ao mirar; some correndo.
	if w and alive:
		var fov := player.camera.fov
		var half_h := get_viewport().get_visible_rect().size.y * 0.5
		var gap := tan(deg_to_rad(w.current_spread)) / tan(deg_to_rad(fov * 0.5)) * half_h
		var ads := w.ads_amount > 0.6
		var sprinting := player.movement.is_sprinting
		_crosshair.set_state(maxf(gap, 4.0), not ads and not sprinting and not w.is_reloading(), ads and not w.is_scoped())
		_scope.visible = w.is_scoped()
		_crosshair.visible = not w.is_scoped()
		# Progresso de recarga.
		_reload_bg.visible = w.is_reloading()
		if w.is_reloading():
			_reload_bar.size.x = _reload_bg.size.x * w.get_reload_progress()
	else:
		_crosshair.set_state(8.0, false, false)
		_scope.visible = false

	# Vinheta de dano: flash + vida baixa.
	_damage_flash = move_toward(_damage_flash, 0.0, delta * 1.8)
	var low := 1.0 - clampf(player.health.current / player.health.max_health, 0.0, 1.0)
	_damage_vignette.modulate.a = clampf(_damage_flash + low * low * 0.8, 0.0, 1.0)

	if _message_time > 0.0:
		_message_time -= delta
		_message_label.modulate.a = clampf(_message_time, 0.0, 1.0)

	if not alive:
		_death_time -= delta
		_death_label.text = "ELIMINADO%s\nrenascendo em %d" % [
			(" por " + _death_killer) if _death_killer != "" else "", maxi(ceili(_death_time), 0)]

	if _rec_label.visible:
		var t := int(Time.get_ticks_msec() / 1000.0 - _rec_start)
		if t != _rec_second:
			_rec_second = t
			var blink := "●" if t % 2 == 0 else "  "
			_rec_label.text = "%s REC  %02d:%02d:%02d\nUNIDADE 07" % [blink, t / 3600, (t / 60) % 60, t % 60]


# ============================================================================
#  Sinais
# ============================================================================
func _on_health_changed(current: float, maximum: float) -> void:
	_health_fill.size.x = 170.0 * clampf(current / maximum, 0.0, 1.0)
	_health_label.text = str(ceili(current))
	_health_fill.color = Color(0.92, 0.94, 0.95, 0.9) if current > maximum * 0.35 else Color(0.95, 0.3, 0.25, 0.95)


func _on_player_damaged(amount: float, _source: Node, _region: StringName) -> void:
	_damage_flash = clampf(_damage_flash + amount / 60.0, 0.0, 0.7)


func _on_weapon_changed(w: Weapon) -> void:
	_weapon_label.text = w.data.display_name.to_upper()
	_on_ammo_changed(w.ammo_in_mag, w.reserve_ammo)
	_update_slots()


func _on_ammo_changed(mag: int, reserve: int) -> void:
	var w := player.weapon_manager.current
	_mag_label.text = str(mag)
	_reserve_label.text = "/ %d" % reserve
	var low := w != null and mag <= int(w.data.magazine_size * 0.25)
	_mag_label.add_theme_color_override("font_color", Color(1, 0.45, 0.35) if low else Color.WHITE)
	if w and mag == 0 and reserve == 0:
		_status_label.text = "SEM MUNIÇÃO"
	elif low and reserve > 0:
		_status_label.text = "[R] RECARREGAR"
	else:
		_status_label.text = ""


func _update_slots() -> void:
	if player == null:
		return
	var parts: PackedStringArray = []
	var cur := player.weapon_manager.current
	for w in player.inventory.get_all():
		var s := str(w.data.slot)
		parts.append("[%s]" % s if w == cur else s)
	_slots_label.text = "  ".join(parts)


func _on_hit_confirmed(attacker: Node, is_kill: bool, is_head: bool) -> void:
	if attacker != player:
		return
	_crosshair.show_hit(is_kill, is_head)
	AudioManager.play_2d("killmarker" if is_kill else "hitmarker", -8.0)


func _on_prompt(text: String) -> void:
	_prompt_label.text = text


func show_message(text: String) -> void:
	_message_label.text = text
	_message_time = 2.5
	_message_label.modulate.a = 1.0


func _on_score_changed(scores: Array) -> void:
	_score_label.text = "AZUL  %d   ·   %d  VERMELHO" % [scores[0], scores[1]]


func _on_time_changed(seconds: int) -> void:
	_time_label.text = "%d:%02d  ·  meta %d" % [seconds / 60, seconds % 60, match_manager.score_limit]


func _on_kill_feed(killer: String, victim: String, weapon: String, headshot: bool, killer_team: int, victim_team: int) -> void:
	var text := ""
	if killer == "":
		text = "%s foi eliminado" % victim
	else:
		text = "%s  [%s%s]  %s" % [killer, weapon, " ◎" if headshot else "", victim]
	var col := Color(0.6, 0.8, 1.0, 0.9) if killer_team == 0 else Color(1.0, 0.6, 0.55, 0.9)
	if killer_team == -1:
		col = Color(1, 1, 1, 0.7) if victim_team == 0 else Color(1, 1, 1, 0.7)
	var l := _label(text, 12, col, HORIZONTAL_ALIGNMENT_RIGHT)
	_feed.add_child(l)
	while _feed.get_child_count() > 5:
		_feed.get_child(0).queue_free()
		_feed.remove_child(_feed.get_child(0))
	get_tree().create_timer(5.0, false).timeout.connect(func():
		if is_instance_valid(l):
			l.queue_free())


func _on_player_died(killer: Node) -> void:
	_death_killer = killer.display_name if killer and is_instance_valid(killer) and killer != player else ""
	_death_time = GameConfig.player_respawn_delay
	_prompt_label.text = ""


func _on_player_respawned() -> void:
	_death_label.text = ""
	_damage_flash = 0.0
