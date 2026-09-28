class_name Crosshair
extends Control
## Mira dinâmica: abre conforme a dispersão real da arma. Ao mirar vira um
## ponto (mira simples). Também desenha o hitmarker.

var gap := 8.0
var show_lines := true
var show_dot := false
var _hit_time := 0.0
var _hit_kill := false
var _hit_head := false


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func set_state(new_gap: float, lines: bool, dot: bool) -> void:
	if absf(new_gap - gap) > 0.3 or lines != show_lines or dot != show_dot:
		gap = new_gap
		show_lines = lines
		show_dot = dot
		queue_redraw()


func show_hit(kill: bool, head: bool) -> void:
	_hit_time = 0.22 if kill else 0.14
	_hit_kill = kill
	_hit_head = head
	set_process(true)
	queue_redraw()


func _process(delta: float) -> void:
	_hit_time -= delta
	if _hit_time <= 0.0:
		set_process(false)
	queue_redraw()


func _draw() -> void:
	var c := size * 0.5
	var col := Color(1, 1, 1, 0.85)
	var shadow := Color(0, 0, 0, 0.5)
	if show_lines:
		var l := 7.0
		for d in [Vector2.RIGHT, Vector2.LEFT, Vector2.UP, Vector2.DOWN]:
			var a: Vector2 = c + d * gap
			var b: Vector2 = c + d * (gap + l)
			draw_line(a + Vector2(1, 1), b + Vector2(1, 1), shadow, 2.0)
			draw_line(a, b, col, 2.0)
	if show_dot:
		draw_circle(c, 2.5, shadow)
		draw_circle(c, 1.8, col)
	if _hit_time > 0.0:
		var hc := Color(1.0, 0.25, 0.2, 0.95) if _hit_kill else (Color(1.0, 0.85, 0.3) if _hit_head else Color(1, 1, 1, 0.95))
		var s0 := 6.0
		var s1 := 13.0 if _hit_kill else 11.0
		for d in [Vector2(1, 1), Vector2(-1, 1), Vector2(1, -1), Vector2(-1, -1)]:
			var dn: Vector2 = d.normalized()
			draw_line(c + dn * s0, c + dn * s1, hc, 2.0)
