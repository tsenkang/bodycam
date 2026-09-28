class_name MainMenu
extends Control
## Menu inicial: dificuldade, tamanho da partida, FOV, sensibilidade e
## efeito bodycam. Salva as escolhas em GameConfig.

signal start_requested

var _diff_buttons: Array[Button] = []
var _mode_buttons: Array[Button] = []
var _time_buttons := {}
var _quality_buttons := {}


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = Color(0.07, 0.075, 0.08)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)

	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var box := VBoxContainer.new()
	box.custom_minimum_size = Vector2(520, 0)
	box.add_theme_constant_override("separation", 14)
	center.add_child(box)

	box.add_child(_title("BODYCAM // PROTÓTIPO", 34))
	box.add_child(_text("Mata-mata em equipe · mapa compacto · bots com IA", 14, Color(1, 1, 1, 0.5)))
	box.add_child(_spacer(10))

	box.add_child(_text("DIFICULDADE DOS BOTS", 12, Color(1, 1, 1, 0.6)))
	var diff_row := HBoxContainer.new()
	diff_row.add_theme_constant_override("separation", 8)
	box.add_child(diff_row)
	for d in [BotConfig.Difficulty.EASY, BotConfig.Difficulty.MEDIUM, BotConfig.Difficulty.HARD]:
		var b := _toggle(BotConfig.DIFFICULTY_NAMES[d])
		b.pressed.connect(func(): _select_difficulty(d))
		diff_row.add_child(b)
		_diff_buttons.append(b)

	box.add_child(_text("TAMANHO DA PARTIDA", 12, Color(1, 1, 1, 0.6)))
	var mode_row := HBoxContainer.new()
	mode_row.add_theme_constant_override("separation", 8)
	box.add_child(mode_row)
	for mode in GameConfig.match_modes.keys():
		var b := _toggle(mode)
		b.pressed.connect(func(): _select_mode(mode))
		mode_row.add_child(b)
		_mode_buttons.append(b)

	box.add_child(_text("HORÁRIO  ·  QUALIDADE GRÁFICA", 12, Color(1, 1, 1, 0.6)))
	var env_row := HBoxContainer.new()
	env_row.add_theme_constant_override("separation", 8)
	box.add_child(env_row)
	for t in ["dia", "entardecer", "noite"]:
		var b := _toggle(t.capitalize())
		b.pressed.connect(func(): _select_time(t))
		env_row.add_child(b)
		_time_buttons[t] = b
	var sep := VSeparator.new()
	env_row.add_child(sep)
	for q in ["baixa", "media", "alta"]:
		var b := _toggle({"baixa": "Baixa", "media": "Média", "alta": "Alta"}[q])
		b.pressed.connect(func(): _select_quality(q))
		env_row.add_child(b)
		_quality_buttons[q] = b

	box.add_child(_slider_row("FOV", 70, 110, GameConfig.camera_fov, func(v): GameConfig.camera_fov = v))
	box.add_child(_slider_row("Sensibilidade", 0.03, 0.4, GameConfig.mouse_sensitivity, func(v): GameConfig.mouse_sensitivity = v, 0.01))
	var fx := CheckBox.new()
	fx.text = "Efeito de lente bodycam"
	fx.button_pressed = GameConfig.bodycam_postfx_enabled
	fx.toggled.connect(func(on): GameConfig.bodycam_postfx_enabled = on)
	box.add_child(fx)

	box.add_child(_spacer(6))
	var play := Button.new()
	play.text = "JOGAR"
	play.custom_minimum_size = Vector2(0, 48)
	play.add_theme_font_size_override("font_size", 20)
	play.pressed.connect(func(): start_requested.emit())
	box.add_child(play)
	var quit := Button.new()
	quit.text = "Sair"
	quit.pressed.connect(func(): get_tree().quit())
	box.add_child(quit)

	box.add_child(_spacer(6))
	box.add_child(_text(
		"WASD mover · Shift correr · C / Ctrl agachar · Espaço pular\n" +
		"Botão esq. atirar · Botão dir. mirar · R recarregar · E interagir\n" +
		"1-5 / roda do mouse trocar arma · Q arma anterior · F lanterna · Esc pausar · F1 (debug) todas as armas",
		12, Color(1, 1, 1, 0.45)))

	_select_difficulty(GameConfig.selected_difficulty)
	_select_mode(GameConfig.selected_mode)
	_select_time(GameConfig.time_of_day)
	_select_quality(GameConfig.graphics_quality)
	play.grab_focus()


func _select_time(t: String) -> void:
	GameConfig.time_of_day = t
	for k in _time_buttons:
		_time_buttons[k].button_pressed = k == t


func _select_quality(q: String) -> void:
	GameConfig.graphics_quality = q
	for k in _quality_buttons:
		_quality_buttons[k].button_pressed = k == q


func _select_difficulty(d: int) -> void:
	GameConfig.selected_difficulty = d
	for i in _diff_buttons.size():
		_diff_buttons[i].button_pressed = i == d


func _select_mode(mode: String) -> void:
	GameConfig.selected_mode = mode
	var keys := GameConfig.match_modes.keys()
	for i in _mode_buttons.size():
		_mode_buttons[i].button_pressed = keys[i] == mode


func _toggle(text: String) -> Button:
	var b := Button.new()
	b.text = text
	b.toggle_mode = true
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.custom_minimum_size = Vector2(0, 36)
	return b


func _title(text: String, size: int) -> Label:
	var l := _text(text, size, Color.WHITE)
	return l


func _text(text: String, size: int, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	return l


func _spacer(h: float) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(0, h)
	return c


func _slider_row(label: String, min_v: float, max_v: float, value: float, on_change: Callable, step := 1.0) -> HBoxContainer:
	var row := HBoxContainer.new()
	var l := _text(label, 13, Color(1, 1, 1, 0.7))
	l.custom_minimum_size = Vector2(130, 0)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	row.add_child(l)
	var s := HSlider.new()
	s.min_value = min_v
	s.max_value = max_v
	s.step = step
	s.value = value
	s.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	s.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(s)
	var v := _text(str(snappedf(value, step)), 13, Color(1, 1, 1, 0.7))
	v.custom_minimum_size = Vector2(50, 0)
	row.add_child(v)
	s.value_changed.connect(func(val):
		on_change.call(val)
		v.text = str(snappedf(val, step)))
	return row
