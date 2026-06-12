extends Node3D
## Main — scena radice. Crea il mondo, la HUD e gestisce il boot.

@onready var world : Node3D = $World
@onready var hud   : CanvasLayer = $HUD
@onready var ui    : CanvasLayer = $UI

var save_timer := 0.0
const SAVE_INTERVAL := 60.0


func _ready() -> void:
	# Read class/name from command line args or default
	var args := OS.get_cmdline_args()
	var class_key  := "guerriero"
	var player_name := "Avventuriero"
	for i in args.size():
		if args[i] == "--class" and i + 1 < args.size():
			class_key = args[i + 1]
		if args[i] == "--name" and i + 1 < args.size():
			player_name = args[i + 1]

	# Try load save
	var sf := FileAccess.open("user://save.json", FileAccess.READ)
	if sf:
		var txt := sf.get_as_text()
		sf.close()
		var data := JSON.parse_string(txt)
		if data and data is Dictionary:
			G.load_save_data(data)
		else:
			G.init_player(class_key, player_name)
	else:
		G.init_player(class_key, player_name)

	# Auto-save loop
	G.player_stats_changed.connect(_on_stats_changed)


func _process(delta: float) -> void:
	save_timer += delta
	if save_timer >= SAVE_INTERVAL:
		save_timer = 0.0
		_save_game()

	# ESC: pause menu
	if Input.is_action_just_pressed("ui_cancel"):
		if get_tree().paused:
			_resume()
		else:
			_pause()


func _save_game() -> void:
	var data := G.get_save_data()
	var txt  := JSON.stringify(data, "\t")
	var sf   := FileAccess.open("user://save.json", FileAccess.WRITE)
	if sf:
		sf.store_string(txt)
		sf.close()


func _pause() -> void:
	get_tree().paused = true
	if ui:
		ui.show_esc_menu(true)


func _resume() -> void:
	get_tree().paused = false
	if ui:
		ui.show_esc_menu(false)


func _on_stats_changed() -> void:
	pass
