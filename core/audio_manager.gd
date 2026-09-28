extends Node
## Gerenciador de áudio (autoload "AudioManager").
##
## - Carrega sons de res://assets/audio/<chave>.(ogg|wav|mp3).
## - Se o arquivo não existir, usa um placeholder gerado (PlaceholderSounds).
## - Reutiliza um "pool" de players para não criar nós a cada disparo.

const POOL_3D := 40
const POOL_2D := 12
const MAX_HEAR_DISTANCE := 90.0

var _streams := {}
var _pool_3d: Array[AudioStreamPlayer3D] = []
var _pool_2d: Array[AudioStreamPlayer] = []
var _next_3d := 0
var _next_2d := 0
var _ambient: AudioStreamPlayer


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for i in POOL_3D:
		var p := AudioStreamPlayer3D.new()
		p.max_distance = MAX_HEAR_DISTANCE
		p.unit_size = 6.0
		p.attenuation_model = AudioStreamPlayer3D.ATTENUATION_INVERSE_DISTANCE
		p.panning_strength = 0.8
		p.process_mode = Node.PROCESS_MODE_PAUSABLE
		add_child(p)
		_pool_3d.append(p)
	for i in POOL_2D:
		var p2 := AudioStreamPlayer.new()
		add_child(p2)
		_pool_2d.append(p2)
	_ambient = AudioStreamPlayer.new()
	add_child(_ambient)
	AudioServer.set_bus_volume_db(0, GameConfig.master_volume_db)


## Retorna o stream da chave (arquivo real ou placeholder), com cache.
func get_stream(key: String) -> AudioStream:
	if key.is_empty():
		return null
	if _streams.has(key):
		return _streams[key]
	var stream: AudioStream = null
	for ext in ["ogg", "wav", "mp3"]:
		var path := "%s%s.%s" % [GameConfig.audio_folder, key, ext]
		if ResourceLoader.exists(path):
			stream = load(path)
			break
	if stream == null:
		stream = PlaceholderSounds.generate(key)
	_streams[key] = stream
	return stream


## Toca um som posicional no mundo.
func play_at(key: String, position: Vector3, volume_db := 0.0, pitch_variation := 0.06) -> void:
	var stream := get_stream(key)
	if stream == null:
		return
	var cam := get_viewport().get_camera_3d()
	if cam and cam.global_position.distance_squared_to(position) > MAX_HEAR_DISTANCE * MAX_HEAR_DISTANCE:
		return
	var p := _pool_3d[_next_3d]
	_next_3d = (_next_3d + 1) % POOL_3D
	p.stream = stream
	p.global_position = position
	p.volume_db = volume_db + GameConfig.sfx_volume_db
	p.pitch_scale = 1.0 + randf_range(-pitch_variation, pitch_variation)
	p.play()


## Toca um som "na cabeça" do jogador (sem posição).
func play_2d(key: String, volume_db := 0.0, pitch_variation := 0.04) -> void:
	var stream := get_stream(key)
	if stream == null:
		return
	var p := _pool_2d[_next_2d]
	_next_2d = (_next_2d + 1) % POOL_2D
	p.stream = stream
	p.volume_db = volume_db + GameConfig.sfx_volume_db
	p.pitch_scale = 1.0 + randf_range(-pitch_variation, pitch_variation)
	p.play()


func start_ambient() -> void:
	_ambient.stream = get_stream("ambient")
	_ambient.volume_db = GameConfig.ambient_volume_db
	if not _ambient.playing:
		_ambient.play()


func stop_ambient() -> void:
	_ambient.stop()


func stop_all() -> void:
	for p in _pool_3d:
		p.stop()
	for p in _pool_2d:
		p.stop()
