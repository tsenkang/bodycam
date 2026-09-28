class_name PlaceholderSounds
extends RefCounted
## Gera sons PROVISÓRIOS por síntese (ruído + tons), para o jogo ter áudio
## mesmo sem arquivos. Para usar sons reais, coloque um arquivo com o mesmo
## nome da chave em res://assets/audio/ (ex.: mp4_fire.ogg) — o AudioManager
## dá prioridade ao arquivo e este gerador deixa de ser usado.

const RATE := 22050

# Parâmetros dos tiros: duração, frequência do "soco" grave, decaimento,
# brilho (0..1, quanto ruído agudo), cauda (eco).
const GUNSHOTS := {
	"mp4_fire": [0.28, 150.0, 22.0, 0.75, 0.25],
	"glock_fire": [0.22, 190.0, 26.0, 0.85, 0.18],
	"shotgun_fire": [0.6, 75.0, 9.0, 0.55, 0.45],
	"ak47_fire": [0.35, 110.0, 16.0, 0.65, 0.35],
	"sniper_fire": [0.95, 62.0, 7.0, 0.6, 0.6],
}


static func generate(key: String) -> AudioStream:
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(key)
	if GUNSHOTS.has(key):
		var p: Array = GUNSHOTS[key]
		return _gunshot(rng, p[0], p[1], p[2], p[3], p[4])
	if key.ends_with("_fire"):
		return _gunshot(rng, 0.3, 130.0, 18.0, 0.7, 0.3)
	match key:
		"reload_mag":
			return _clicks(rng, [0.0, 0.08, 0.55, 0.62, 1.2], 1.4)
		"reload_pistol":
			return _clicks(rng, [0.0, 0.45, 0.52, 0.95], 1.1)
		"reload_shell":
			return _clicks(rng, [0.0, 0.06], 0.25)
		"pump":
			return _clicks(rng, [0.0, 0.18], 0.35, 900.0)
		"bolt":
			return _clicks(rng, [0.0, 0.2, 0.42], 0.6, 1200.0)
		"weapon_draw":
			return _rustle(rng, 0.25, true)
		"empty_click":
			return _clicks(rng, [0.0], 0.08, 3000.0)
		"footstep":
			return _thud(rng, 0.11, 90.0, 0.35)
		"land":
			return _thud(rng, 0.2, 70.0, 0.5)
		"impact_world":
			return _impact(rng, 0.09, 0.9)
		"impact_flesh":
			return _thud(rng, 0.1, 140.0, 0.2)
		"hitmarker":
			return _tone(0.05, 2400.0, 0.35)
		"killmarker":
			return _tone(0.09, 1800.0, 0.4)
		"door":
			return _creak(rng, 0.45)
		"pickup":
			return _two_tone()
		"ambient":
			return _ambient(rng, 6.0)
	return _clicks(rng, [0.0], 0.1)


# ---------------------------------------------------------------------------
static func _to_stream(samples: PackedFloat32Array, loop := false) -> AudioStreamWAV:
	var bytes := PackedByteArray()
	bytes.resize(samples.size() * 2)
	for i in samples.size():
		bytes.encode_s16(i * 2, int(clampf(samples[i], -1.0, 1.0) * 32767.0))
	var s := AudioStreamWAV.new()
	s.format = AudioStreamWAV.FORMAT_16_BITS
	s.mix_rate = RATE
	s.stereo = false
	s.data = bytes
	if loop:
		s.loop_mode = AudioStreamWAV.LOOP_FORWARD
		s.loop_begin = 0
		s.loop_end = samples.size()
	return s


static func _gunshot(rng: RandomNumberGenerator, length: float, boom_freq: float,
		decay: float, brightness: float, tail: float) -> AudioStream:
	var n := int(length * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var lp := 0.0
	for i in n:
		var t := float(i) / RATE
		var noise := rng.randf_range(-1.0, 1.0)
		lp += (noise - lp) * (0.15 + 0.5 * brightness)
		var crack := lerpf(lp, noise, brightness * 0.5) * exp(-t * decay * 1.6)
		var boom := sin(TAU * boom_freq * t * (1.0 - t * 0.8)) * exp(-t * decay * 0.7)
		var echo := lp * tail * exp(-t * 4.0) * 0.4
		out[i] = (crack * 0.8 + boom * 0.9 + echo) * 0.85
	return _to_stream(out)


static func _clicks(rng: RandomNumberGenerator, times: Array, length: float, freq := 1600.0) -> AudioStream:
	var n := int(length * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	for start in times:
		var s0 := int(float(start) * RATE)
		var f := freq * rng.randf_range(0.8, 1.2)
		for j in int(0.035 * RATE):
			var idx := s0 + j
			if idx >= n:
				break
			var t := float(j) / RATE
			var v := (rng.randf_range(-1.0, 1.0) * 0.6 + sin(TAU * f * t) * 0.5) * exp(-t * 120.0)
			out[idx] += v * 0.7
	return _to_stream(out)


static func _thud(rng: RandomNumberGenerator, length: float, freq: float, noise_amt: float) -> AudioStream:
	var n := int(length * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var lp := 0.0
	for i in n:
		var t := float(i) / RATE
		lp += (rng.randf_range(-1.0, 1.0) - lp) * 0.08
		out[i] = (sin(TAU * freq * t) * 0.7 + lp * noise_amt * 3.0) * exp(-t * 30.0)
	return _to_stream(out)


static func _impact(rng: RandomNumberGenerator, length: float, brightness: float) -> AudioStream:
	var n := int(length * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	for i in n:
		var t := float(i) / RATE
		out[i] = rng.randf_range(-1.0, 1.0) * brightness * exp(-t * 55.0) * 0.6
	return _to_stream(out)


static func _rustle(rng: RandomNumberGenerator, length: float, end_click: bool) -> AudioStream:
	var n := int(length * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var lp := 0.0
	for i in n:
		var t := float(i) / RATE
		lp += (rng.randf_range(-1.0, 1.0) - lp) * 0.25
		var env := sin(PI * t / length)
		out[i] = lp * env * 0.35
	if end_click:
		var s0 := int(length * 0.8 * RATE)
		for j in int(0.02 * RATE):
			if s0 + j < n:
				out[s0 + j] += rng.randf_range(-1.0, 1.0) * exp(-float(j) / RATE * 150.0) * 0.6
	return _to_stream(out)


static func _tone(length: float, freq: float, volume: float) -> AudioStream:
	var n := int(length * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	for i in n:
		var t := float(i) / RATE
		out[i] = sin(TAU * freq * t) * exp(-t * 40.0) * volume
	return _to_stream(out)


static func _two_tone() -> AudioStream:
	var n := int(0.18 * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	for i in n:
		var t := float(i) / RATE
		var f := 880.0 if t < 0.08 else 1320.0
		out[i] = sin(TAU * f * t) * 0.3 * exp(-fmod(t, 0.08) * 20.0)
	return _to_stream(out)


static func _creak(rng: RandomNumberGenerator, length: float) -> AudioStream:
	var n := int(length * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var phase := 0.0
	for i in n:
		var t := float(i) / RATE
		phase += TAU * (180.0 + 90.0 * sin(t * 9.0)) / RATE
		var saw := fmod(phase, TAU) / TAU * 2.0 - 1.0
		out[i] = (saw * 0.25 + rng.randf_range(-0.05, 0.05)) * sin(PI * t / length)
	return _to_stream(out)


static func _ambient(rng: RandomNumberGenerator, length: float) -> AudioStream:
	# Ruído marrom (vento/cidade distante) com emenda suave para loop.
	var n := int(length * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var brown := 0.0
	for i in n:
		var t := float(i) / RATE
		brown = clampf(brown + rng.randf_range(-1.0, 1.0) * 0.02, -1.0, 1.0) * 0.998
		var swell := 0.6 + 0.4 * sin(TAU * t / length)
		out[i] = brown * swell * 0.8
	var fade := int(0.3 * RATE)
	for i in fade:
		var w := float(i) / fade
		out[i] = out[i] * w + out[n - fade + i] * (1.0 - w)
	return _to_stream(out, true)
