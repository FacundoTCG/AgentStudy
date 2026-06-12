extends Node
## FishingSystem — macchina a stati per la pesca stile Metin2.
## Premi G vicino all'acqua (y < 1.5) con la Canna da Pesca nell'inventario.
## IDLE → WAITING (attendi il morso) → BITING (premi G entro 2s) → CAUGHT/MISSED.

enum State { IDLE, WAITING, BITING }

var state     := State.IDLE
var wait_time := 0.0   # seconds until bite
var bite_time := 0.0   # remaining window to catch
var float_root : Node3D = null

const FISH_POOL := [
	["pesce_carpa",    60],
	["pesce_trota",    30],
	["pesce_branzino", 15],
	["pesce_anguilla", 12],
	["pesce_salmone",   5],
	["pesce_mostro",    1],
]


func _ready() -> void:
	add_to_group("fishing_system")
	set_process(true)


func _process(delta: float) -> void:
	match state:
		State.WAITING:
			wait_time -= delta
			if wait_time <= 0.0:
				_start_bite()
		State.BITING:
			bite_time -= delta
			if bite_time <= 0.0:
				_miss()


func handle_input() -> void:
	match state:
		State.IDLE:
			try_cast()
		State.WAITING:
			cancel()
		State.BITING:
			try_catch()


func try_cast() -> void:
	var player := _find_player()
	if player == null:
		return
	if not _near_water(player):
		G.notification.emit("Pesca vicino all'acqua! (terreno basso)", "error")
		return
	if not _has_rod():
		G.notification.emit("Serve una Canna da Pesca nell'inventario!", "error")
		return
	_spawn_float(player)
	wait_time = randf_range(3.5, 9.0)
	state = State.WAITING
	G.notification.emit("Amo lanciato! Aspetta il morso...", "info")


func try_catch() -> void:
	if state != State.BITING:
		return
	_do_catch()


func cancel() -> void:
	state = State.IDLE
	_despawn_float()
	G.notification.emit("Pesca annullata.", "info")


func _start_bite() -> void:
	state = State.BITING
	bite_time = 2.2
	G.notification.emit("[ G ] Pesca ora! Il galleggiante scende!", "success")
	if is_instance_valid(float_root):
		var tw := create_tween()
		var base_y := float_root.position.y
		tw.tween_property(float_root, "position:y", base_y - 0.32, 0.18)
		tw.tween_property(float_root, "position:y", base_y,        0.14)
		tw.tween_property(float_root, "position:y", base_y - 0.28, 0.12)
		tw.tween_property(float_root, "position:y", base_y,        0.12)


func _miss() -> void:
	state = State.IDLE
	_despawn_float()
	G.notification.emit("Scappato! Riprova.", "error")


func _do_catch() -> void:
	state = State.IDLE
	_despawn_float()
	# Weighted random selection
	var total := 0
	for f in FISH_POOL:
		total += f[1]
	var roll := randi() % total
	var cumulative := 0
	var caught_id := FISH_POOL[0][0]
	for f in FISH_POOL:
		cumulative += f[1]
		if roll < cumulative:
			caught_id = f[0]
			break
	if G.add_item(caught_id):
		var fname := Data.ITEMS.get(caught_id, {}).get("name", "?")
		G.fish_caught += 1
		G.notification.emit("Hai pescato: %s!" % fname, "success")
		G.combat_message.emit("🐟 %s" % fname, "loot")
		G.check_achievements()
	else:
		G.notification.emit("Inventario pieno! Il pesce è scappato.", "error")


func _near_water(player: Node3D) -> bool:
	return player.global_position.y < 1.5


func _has_rod() -> bool:
	for i in G.INV_SIZE:
		var inst := G.inventory[i]
		if inst and Data.ITEMS.get(inst["id"], {}).get("kind") == "fishing_rod":
			return true
	return false


func _spawn_float(player: Node3D) -> void:
	_despawn_float()
	float_root = Node3D.new()
	var pp := player.global_position
	var angle := randf() * TAU
	var cast_pos := Vector3(pp.x + cos(angle) * 2.8, 0.12, pp.z + sin(angle) * 2.8)
	float_root.position = cast_pos

	# Cork body
	var cork_m := SphereMesh.new()
	cork_m.radius = 0.12; cork_m.height = 0.24
	var cork_mat := StandardMaterial3D.new()
	cork_mat.albedo_color = Color(0.9, 0.22, 0.12)
	cork_mat.roughness = 0.75
	var cork_mi := MeshInstance3D.new()
	cork_mi.mesh = cork_m; cork_mi.material_override = cork_mat
	float_root.add_child(cork_mi)

	# Antenna
	var ant_m := CylinderMesh.new()
	ant_m.top_radius = 0.015; ant_m.bottom_radius = 0.015; ant_m.height = 0.30
	var ant_mat := StandardMaterial3D.new()
	ant_mat.albedo_color = Color(0.85, 0.80, 0.45)
	var ant_mi := MeshInstance3D.new()
	ant_mi.mesh = ant_m; ant_mi.material_override = ant_mat
	ant_mi.position = Vector3(0, 0.23, 0)
	float_root.add_child(ant_mi)

	# Fishing line (thin cylinder to player)
	var dir := (pp - cast_pos)
	dir.y = 0
	var line_len := dir.length()
	if line_len > 0.1:
		var line_m := CylinderMesh.new()
		line_m.top_radius = 0.01; line_m.bottom_radius = 0.01; line_m.height = line_len
		var line_mat := StandardMaterial3D.new()
		line_mat.albedo_color = Color(0.85, 0.82, 0.55, 0.7)
		line_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		var line_mi := MeshInstance3D.new()
		line_mi.mesh = line_m; line_mi.material_override = line_mat
		line_mi.position = dir.normalized() * (line_len * 0.5) + Vector3(0, 0.6, 0)
		line_mi.rotation.z = -PI * 0.5
		line_mi.rotation.y = atan2(dir.x, dir.z)
		float_root.add_child(line_mi)

	get_parent().add_child(float_root)


func _despawn_float() -> void:
	if is_instance_valid(float_root):
		float_root.queue_free()
	float_root = null


func _find_player() -> Node3D:
	var arr := get_tree().get_nodes_in_group("player")
	return arr[0] if arr.size() > 0 else null
