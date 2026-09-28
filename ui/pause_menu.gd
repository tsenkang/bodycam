class_name PauseMenu
extends CanvasLayer
## Pausa (Esc) e tela de fim de partida.

signal resume_requested
signal restart_requested
signal menu_requested

var _panel: Control
var _title: Label
var _resume: Button
var _ended := false


func _ready() -> void:
	layer = 20
	process_mode = Node.PROCESS_MODE_ALWAYS
	_panel = ColorRect.new()
	(_panel as ColorRect).color = Color(0, 0, 0, 0.6)
	_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_panel)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	_panel.add_child(center)
	var box := VBoxContainer.new()
	box.custom_minimum_size = Vector2(320, 0)
	box.add_theme_constant_override("separation", 10)
	center.add_child(box)
	_title = Label.new()
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_title.add_theme_font_size_override("font_size", 26)
	box.add_child(_title)
	_resume = _button(box, "Continuar", func(): resume_requested.emit())
	_button(box, "Reiniciar partida", func(): restart_requested.emit())
	_button(box, "Menu principal", func(): menu_requested.emit())
	_panel.visible = false


func _button(parent: Control, text: String, cb: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(0, 40)
	b.pressed.connect(cb)
	parent.add_child(b)
	return b


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause") and not _ended:
		if _panel.visible:
			resume_requested.emit()
		else:
			show_pause()
		get_viewport().set_input_as_handled()


func show_pause() -> void:
	_title.text = "PAUSADO"
	_resume.visible = true
	_open()
	get_tree().paused = true


func show_end(title: String) -> void:
	_ended = true
	_title.text = title
	_resume.visible = false
	_open()


func hide_menu() -> void:
	_panel.visible = false
	get_tree().paused = false


func is_open() -> bool:
	return _panel.visible


func _open() -> void:
	_panel.visible = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
