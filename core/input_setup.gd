class_name InputSetup
extends RefCounted
## Registra as ações de input via código (fácil de alterar aqui).

const KEY_ACTIONS := {
	"move_forward": [KEY_W],
	"move_back": [KEY_S],
	"move_left": [KEY_A],
	"move_right": [KEY_D],
	"sprint": [KEY_SHIFT],
	"crouch_toggle": [KEY_C],
	"crouch_hold": [KEY_CTRL],
	"jump": [KEY_SPACE],
	"reload": [KEY_R],
	"interact": [KEY_E],
	"quick_switch": [KEY_Q],
	"weapon_1": [KEY_1],
	"weapon_2": [KEY_2],
	"weapon_3": [KEY_3],
	"weapon_4": [KEY_4],
	"weapon_5": [KEY_5],
	"pause": [KEY_ESCAPE],
	"debug_unlock_all": [KEY_F1],
	"flashlight": [KEY_F],
}

const MOUSE_ACTIONS := {
	"fire": [MOUSE_BUTTON_LEFT],
	"aim": [MOUSE_BUTTON_RIGHT],
	"next_weapon": [MOUSE_BUTTON_WHEEL_DOWN],
	"prev_weapon": [MOUSE_BUTTON_WHEEL_UP],
}


static func register_actions() -> void:
	for action in KEY_ACTIONS:
		_ensure(action)
		for key in KEY_ACTIONS[action]:
			var ev := InputEventKey.new()
			ev.physical_keycode = key
			InputMap.action_add_event(action, ev)
	for action in MOUSE_ACTIONS:
		_ensure(action)
		for button in MOUSE_ACTIONS[action]:
			var ev := InputEventMouseButton.new()
			ev.button_index = button
			InputMap.action_add_event(action, ev)


static func _ensure(action: String) -> void:
	if InputMap.has_action(action):
		InputMap.action_erase_events(action)
	else:
		InputMap.add_action(action)
