class_name WeaponData
extends Resource
## Dados (estatísticas) de uma arma. Preenchido a partir de WeaponConfig.
## Os valores padrão abaixo são só "fallback"; os reais estão no config.

enum FireMode { AUTO, SEMI, PUMP, BOLT }

var id: StringName = &""
var display_name := "Arma"
var category := ""
var script_path := ""
var slot := 1
var fire_mode: FireMode = FireMode.AUTO

var damage := 20.0
var fire_rate := 600.0
var pellets := 1
var pellet_spread := 0.0
var magazine_size := 30
var reserve_ammo := 90
var max_reserve := 180
var reload_time := 2.0
var reload_empty_time := 2.4
var reload_commit := 0.7
var reload_start_time := 0.3
var reload_end_time := 0.3
var effective_range := 20.0
var max_range := 150.0
var min_damage_ratio := 0.6

var accuracy := 0.8
var hip_spread := 2.5
var ads_spread := 0.4
var move_spread := 1.2
var bloom_per_shot := 0.3
var max_bloom := 2.0
var bloom_recovery := 6.0

var recoil_vertical := 1.0
var recoil_horizontal := 0.4
var recoil_horizontal_bias := 0.0
var recoil_recovery := 8.0
var recoil_aim_carry := 0.4
var ads_recoil_mult := 0.85
var visual_kick := 0.03
var visual_kick_rotation := 3.0
var camera_shake := 0.2

var ads_zoom := 1.25
var ads_time := 0.2
var weight := 3.0
var move_speed_mult := 1.0
var draw_time := 0.45
var holster_time := 0.3
var noise_radius := 45.0

var sight := "iron"
var model_type := "smg"
var model_color := Color(0.15, 0.15, 0.15)
var model_scene := ""
## Ajustes do modelo importado (ver WeaponModelBuilder.fit_scene).
var model_rotation := Vector3.ZERO
var model_length := 0.85
var model_rear_fraction := 0.42
var model_sight_drop := 0.005
var model_offset := Vector3.ZERO
var model_hidden_bones: Array = []
var model_hands := false
var hip_position := Vector3(0.17, -0.2, -0.38)
var ads_distance := 0.26
var sprint_rotation := Vector3(-12.0, 38.0, 14.0)

var sound_fire := ""
var sound_reload := ""
var sound_draw := ""
var sound_empty := ""
var sound_action := ""


## Cria os dados a partir do ID em WeaponConfig.WEAPONS.
static func from_config(weapon_id: StringName) -> WeaponData:
	assert(WeaponConfig.WEAPONS.has(weapon_id), "Arma desconhecida: %s" % weapon_id)
	var cfg: Dictionary = WeaponConfig.WEAPONS[weapon_id]
	var d := WeaponData.new()
	d.id = weapon_id
	for key in cfg:
		if key == "fire_mode":
			d.fire_mode = FireMode[String(cfg[key]).to_upper()]
		elif key in d:
			d.set(key, cfg[key])
		else:
			push_warning("WeaponConfig: campo desconhecido '%s' em %s" % [key, weapon_id])
	return d


## Tempo mínimo entre disparos (segundos).
func seconds_per_shot() -> float:
	return 60.0 / maxf(fire_rate, 1.0)


func is_automatic() -> bool:
	return fire_mode == FireMode.AUTO


## Dano com queda linear entre o alcance efetivo e o alcance máximo.
func damage_at_distance(distance: float) -> float:
	if distance <= effective_range:
		return damage
	var t := clampf((distance - effective_range) / maxf(max_range - effective_range, 0.01), 0.0, 1.0)
	return damage * lerpf(1.0, min_damage_ratio, t)
