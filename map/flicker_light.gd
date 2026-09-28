extends OmniLight3D
## Lâmpada fluorescente "falhando" — detalhe de ambientação.

var _base := 1.0
var _timer := 0.0


func _ready() -> void:
	_base = light_energy


func _process(delta: float) -> void:
	_timer -= delta
	if _timer > 0.0:
		return
	if randf() < 0.12:
		light_energy = _base * randf_range(0.0, 0.3)
		_timer = randf_range(0.03, 0.12)
	else:
		light_energy = _base
		_timer = randf_range(0.2, 1.5)
