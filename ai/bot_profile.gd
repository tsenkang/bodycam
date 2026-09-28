class_name BotProfile
extends RefCounted
## Parâmetros de uma dificuldade, lidos de BotConfig.PROFILES.

var difficulty := BotConfig.Difficulty.MEDIUM
var reaction_time := 0.45
var damage_reaction_time := 0.55
var detection_range := 40.0
var detection_time := 0.75
var fov_degrees := 110.0
var hearing_multiplier := 0.7
var reacts_to_gunshots := true
var aim_error_deg := 3.0
var initial_error_mult := 1.8
var aim_settle_time := 1.0
var moving_target_penalty := 0.8
var headshot_chance := 0.08
var burst_shots := Vector2i(3, 6)
var burst_pause := Vector2(0.3, 0.6)
var turn_speed_deg := 220.0
var decision_interval := 0.4
var perception_interval := 0.2
var cover_usage := 0.4
var flank_chance := 0.15
var strafe_skill := 0.5
var reposition_interval := 6.0
var chase_enabled := true
var max_chase_distance := 30.0
var search_time := 6.0
var prediction := 0.5
var aggression := 0.5
var team_callouts := true
var move_speed_mult := 1.0
var weapon_pool: Array = [&"mp4"]


static func from_difficulty(d: int) -> BotProfile:
	var p := BotProfile.new()
	p.difficulty = d
	var cfg: Dictionary = BotConfig.PROFILES[d]
	for key in cfg:
		if key in p:
			p.set(key, cfg[key])
		else:
			push_warning("BotConfig: campo desconhecido '%s'" % key)
	return p
