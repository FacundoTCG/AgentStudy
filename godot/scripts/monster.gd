extends CharacterBody3D
## Monster — AI con state machine: idle / patrol / chase / attack / dead
## Pathfinding via NavigationAgent3D (baked dal World).

const GRAVITY       := 18.0
const NOTICE_RANGE  := 14.0
const LOSE_RANGE    := 28.0
const ATK_RANGE     := 2.4
const PATROL_RADIUS := 12.0

enum State { IDLE, PATROL, CHASE, ATTACK, DEAD }

@export var mob_id   : String = ""

@onready var nav_agent   : NavigationAgent3D = $NavigationAgent3D
@onready var name_label  : Label3D           = $NameLabel
@onready var hp_bar_mesh : MeshInstance3D    = $HPBarMesh
@onready var anim        : AnimationPlayer   = $MeshRoot/AnimationPlayer

var mob_name   := ""
var level      := 1
var hp         := 100
var max_hp     := 100
var atk        := 10
var def        := 5
var speed      := 4.5
var aggressive := false
var is_boss    := false

var state        := State.IDLE
var spawn_pos    : Vector3
var patrol_target: Vector3
var player_ref   : Node3D = null
var atk_cd       := 0.0
var idle_t       := 0.0
var loot_given   := false

# Status effects
var statuses : Dictionary = {}   # id → remains_sec


func setup(data: Dictionary) -> void:
	mob_id   = data["id"]
	mob_name = data["name"]
	level    = data["lvl"]
	hp       = data["hp"]
	max_hp   = data["hp"]
	atk      = data["atk"]
	def      = data.get("def", int(level * 1.1))
	speed    = data.get("speed", 4.5)
	aggressive = data.get("aggressive", false)
	is_boss  = data.get("boss", false)
	scale    = Vector3.ONE * data.get("scale", 1.0)
	spawn_pos = global_position
	patrol_target = spawn_pos
	state = State.IDLE
	if name_label:
		name_label.text = "%s  Lv %d" % [mob_name, level]
		_update_name_label_color()
	_apply_zone_color(data)
	_vary_body_shape(data)
	if is_boss:
		_add_boss_aura()
	add_to_group("monsters")


func _update_name_label_color() -> void:
	if name_label == null:
		return
	if is_boss:
		name_label.modulate = Color(1.0, 0.5, 0.12)
		return
	var pl_lvl := G.player_data.get("level", 1)
	var diff := level - pl_lvl
	if diff >= 10:
		name_label.modulate = Color(1.0, 0.1, 0.1)
	elif diff >= 5:
		name_label.modulate = Color(1.0, 0.55, 0.28)
	elif diff <= -5:
		name_label.modulate = Color(0.5, 0.5, 0.5)
	else:
		name_label.modulate = Color(0.96, 0.85, 0.7)


func _vary_body_shape(data: Dictionary) -> void:
	var body_node := get_node_or_null("MeshRoot/Body")
	var head_node := get_node_or_null("MeshRoot/Head")
	if body_node == null:
		return
	var id_str: String = data.get("id", "mob_z1_0")
	var role := int(id_str.substr(id_str.rfind("_") + 1)) % 4
	match role:
		1:  # Stout / orcish
			body_node.scale = Vector3(1.35, 0.88, 1.35)
			if head_node: head_node.scale = Vector3(1.2, 1.05, 1.2)
		2:  # Skeletal / tall
			body_node.scale = Vector3(0.75, 1.48, 0.75)
			if head_node:
				head_node.scale = Vector3(0.9, 0.9, 0.9)
				head_node.position.y += 0.25
		3:  # Beast-like — elongated low body
			body_node.scale = Vector3(1.18, 0.72, 1.65)
			if head_node: head_node.scale = Vector3(1.05, 0.85, 1.25)


func _add_boss_aura() -> void:
	var aura_m := SphereMesh.new(); aura_m.radius = 1.15; aura_m.height = 2.3
	var aura_mi := MeshInstance3D.new()
	aura_mi.mesh = aura_m
	var aura_mat := StandardMaterial3D.new()
	aura_mat.albedo_color = Color(0.85, 0.12, 0.12, 0.12)
	aura_mat.emission_enabled = true
	aura_mat.emission = Color(1.0, 0.2, 0.1) * 0.35
	aura_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	aura_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	aura_mi.material_override = aura_mat
	aura_mi.position = Vector3(0, 0.75, 0)
	aura_mi.name = "BossAura"
	add_child(aura_mi)


func _apply_zone_color(data: Dictionary) -> void:
	var zone_idx: int = data.get("zone", 1) - 1
	var zone_cols := [
		Color(0.55, 0.42, 0.28), Color(0.22, 0.38, 0.22), Color(0.48, 0.40, 0.22),
		Color(0.58, 0.32, 0.20), Color(0.38, 0.35, 0.45), Color(0.25, 0.36, 0.30),
		Color(0.60, 0.38, 0.22), Color(0.40, 0.38, 0.48),
	]
	var body_col: Color = zone_cols[clampi(zone_idx, 0, 7)]
	if is_boss:
		body_col = body_col.lerp(Color(0.8, 0.1, 0.1), 0.4)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = body_col
	mat.roughness = 0.8
	var body_node := get_node_or_null("MeshRoot/Body")
	if body_node:
		body_node.material_override = mat
	var head_mat := StandardMaterial3D.new()
	head_mat.albedo_color = body_col.darkened(0.25)
	head_mat.roughness = 0.8
	var head_node := get_node_or_null("MeshRoot/Head")
	if head_node:
		head_node.material_override = head_mat


func _ready() -> void:
	add_to_group("monsters")
	if nav_agent:
		nav_agent.max_speed = speed
		nav_agent.path_desired_distance = 0.5
		nav_agent.target_desired_distance = 0.8


func _physics_process(delta: float) -> void:
	if state == State.DEAD:
		return

	_tick_statuses(delta)
	atk_cd = maxf(0.0, atk_cd - delta)

	# Idle bob — subtle breathing when not moving
	if state == State.IDLE:
		var mesh_r := get_node_or_null("MeshRoot")
		if mesh_r:
			var tb := Time.get_ticks_msec() * 0.001
			mesh_r.position.y = sin(tb * 1.2 + spawn_pos.x * 0.5) * 0.025

	# Find player
	if player_ref == null or not is_instance_valid(player_ref):
		player_ref = _find_player()

	var dist := INF
	if player_ref:
		dist = global_position.distance_to(player_ref.global_position)

	_update_state(delta, dist)
	_move(delta)
	_apply_gravity(delta)
	_update_hp_bar()

	move_and_slide()


func _update_state(delta: float, dist: float) -> void:
	match state:
		State.IDLE:
			idle_t += delta
			if idle_t > 3.0:
				idle_t = 0.0
				if aggressive and player_ref and dist < NOTICE_RANGE:
					state = State.CHASE
				else:
					_pick_patrol()
					state = State.PATROL

		State.PATROL:
			if aggressive and player_ref and dist < NOTICE_RANGE:
				state = State.CHASE
			var d_pt := global_position.distance_to(patrol_target)
			if d_pt < 1.0:
				state = State.IDLE

		State.CHASE:
			if not player_ref or dist > LOSE_RANGE:
				state = State.IDLE
				_return_to_spawn()
			elif dist <= ATK_RANGE:
				state = State.ATTACK
			else:
				if nav_agent:
					nav_agent.target_position = player_ref.global_position

		State.ATTACK:
			if not player_ref or dist > ATK_RANGE + 1.0:
				state = State.CHASE
			elif atk_cd <= 0.0:
				_perform_attack()


func _move(delta: float) -> void:
	var wish := Vector3.ZERO
	match state:
		State.PATROL:
			var dir := (patrol_target - global_position)
			dir.y = 0
			if dir.length() > 0.5:
				wish = dir.normalized() * speed * 0.55
		State.CHASE:
			if nav_agent and not nav_agent.is_navigation_finished():
				var next := nav_agent.get_next_path_position()
				var dir := (next - global_position)
				dir.y = 0
				if dir.length() > 0.1:
					wish = dir.normalized() * speed
			elif player_ref:
				var dir := (player_ref.global_position - global_position)
				dir.y = 0
				if dir.length() > 0.1:
					wish = dir.normalized() * speed
		State.ATTACK:
			if player_ref:
				var dir := (player_ref.global_position - global_position)
				dir.y = 0
				if dir.length() > 0.1:
					look_at(global_position + dir, Vector3.UP)

	velocity.x = lerp(velocity.x, wish.x, 12.0 * delta)
	velocity.z = lerp(velocity.z, wish.z, 12.0 * delta)

	# Rotate toward velocity
	if velocity.length() > 0.4:
		var flat := Vector3(velocity.x, 0, velocity.z)
		if flat.length() > 0.1:
			look_at(global_position + flat, Vector3.UP)


func _apply_gravity(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= GRAVITY * delta
	else:
		velocity.y = -0.3


func _perform_attack() -> void:
	if not is_instance_valid(player_ref):
		return
	var cd_time := 1.8 if not is_boss else 2.4
	atk_cd = cd_time
	var raw_dmg := atk + randi() % maxi(1, atk / 4)
	if player_ref.has_method("take_damage"):
		player_ref.take_damage(raw_dmg)
	if anim and anim.has_animation("attack"):
		anim.play("attack")


func take_damage(amount: int, source: Node3D = null) -> void:
	if state == State.DEAD:
		return
	var actual := maxi(1, amount - int(def * 0.3))
	hp -= actual
	_flash_hit()
	_show_damage_number(actual, G.last_crit)
	G.combat_message.emit("-%d" % actual, "damage")
	if not aggressive and state == State.IDLE:
		state = State.CHASE
	if source and player_ref == null:
		player_ref = source
	if hp <= 0:
		_die(source)


func _flash_hit() -> void:
	var body_node := get_node_or_null("MeshRoot/Body")
	if body_node == null:
		return
	var orig_mat: Material = body_node.material_override
	var flash_mat := StandardMaterial3D.new()
	flash_mat.albedo_color = Color(1.0, 0.3, 0.3)
	flash_mat.emission_enabled = true
	flash_mat.emission = Color(1.0, 0.2, 0.2) * 0.5
	body_node.material_override = flash_mat
	var t := get_tree().create_timer(0.12)
	t.timeout.connect(func():
		if is_instance_valid(body_node):
			body_node.material_override = orig_mat)


func _show_damage_number(amount: int, is_crit: bool = false) -> void:
	var lbl := Label3D.new()
	lbl.text = "-%d" % amount
	lbl.font_size = 32 if is_crit else 22
	lbl.modulate = Color(1.0, 0.85, 0.2) if is_crit else Color(1.0, 0.35, 0.35)
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lbl.no_depth_test = true
	var offset := Vector3(randf_range(-0.4, 0.4), 1.6 + scale.y * 0.5, randf_range(-0.2, 0.2))
	lbl.position = global_position + offset
	get_parent().add_child(lbl)
	var tw := get_tree().create_tween()
	tw.tween_property(lbl, "position:y", lbl.position.y + 2.0, 1.4)
	tw.parallel().tween_property(lbl, "modulate:a", 0.0, 1.4)
	tw.tween_callback(lbl.queue_free)


func apply_status(status_id: String, duration: float) -> void:
	statuses[status_id] = duration
	_show_status_icon(status_id)


func _show_status_icon(status_id: String) -> void:
	var icons := {"poison": "☠", "slow": "❄", "stun": "⭐", "root": "🌿", "weaken": "💀"}
	var cols  := {"poison": Color(0.25, 0.9, 0.25), "slow": Color(0.4, 0.65, 1.0),
		"stun": Color(1.0, 0.9, 0.2), "root": Color(0.35, 0.85, 0.35), "weaken": Color(0.75, 0.5, 1.0)}
	var lbl := Label3D.new()
	lbl.text = icons.get(status_id, "?")
	lbl.font_size = 26
	lbl.modulate = cols.get(status_id, Color.WHITE)
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lbl.no_depth_test = true
	lbl.position = global_position + Vector3(randf_range(-0.3, 0.3), 1.9, 0)
	get_parent().add_child(lbl)
	var tw := get_tree().create_tween()
	tw.tween_property(lbl, "position:y", lbl.position.y + 0.6, 0.6)
	tw.tween_property(lbl, "modulate:a", 0.0, 0.4)
	tw.tween_callback(lbl.queue_free)


func _tick_statuses(delta: float) -> void:
	var to_remove := []
	for sid in statuses.keys():
		statuses[sid] -= delta
		match sid:
			"poison":
				if Engine.get_frames_drawn() % 60 == 0:
					take_damage(int(max_hp * 0.02))
			"slow":
				speed = Data.MONSTERS.get(mob_id, {}).get("speed", 4.5) * 0.5
		if statuses[sid] <= 0.0:
			to_remove.append(sid)
	for sid in to_remove:
		statuses.erase(sid)
		if sid == "slow":
			speed = Data.MONSTERS.get(mob_id, {}).get("speed", 4.5)


func _die(killer: Node3D = null) -> void:
	state = State.DEAD
	remove_from_group("monsters")
	add_to_group("dead")
	velocity = Vector3.ZERO
	if name_label:
		name_label.visible = false

	if killer and killer.has_method("get_stats") and not loot_given:
		loot_given = true
		var mob_def: Dictionary = Data.MONSTERS.get(mob_id, {})
		# XP
		G.gain_xp(mob_def.get("xp", level * 14), true)
		# Gold
		var gr: Array = mob_def.get("gold", [level * 2, level * 5])
		var gold := gr[0] + randi() % maxi(1, gr[1] - gr[0])
		G.gain_gold(gold)
		G.player_data["kills"] += 1
		# Quest tracking
		G.on_kill(mob_id)
		G.mob_killed.emit(mob_id, mob_name, mob_def.get("xp", 0), gold)
		G.combat_message.emit("+%d oro, +%d XP" % [gold, mob_def.get("xp", 0)], "loot")
		# Drop loot
		_drop_loot(mob_def.get("drops", []))

	# Fade-out then despawn
	var mesh_root := get_node_or_null("MeshRoot")
	if mesh_root:
		var tw := get_tree().create_tween()
		tw.tween_interval(1.5)
		tw.tween_property(mesh_root, "modulate:a", 0.0, 1.0)
	var t := get_tree().create_timer(3.0)
	t.timeout.connect(_despawn)


func _drop_loot(drops: Array) -> void:
	for entry in drops:
		if entry.has("id"):
			if randf() < entry.get("chance", 0.1):
				var qty := 1
				if entry.has("qty"):
					qty = entry["qty"][0] + randi() % maxi(1, entry["qty"][1] - entry["qty"][0] + 1)
				G.add_item(entry["id"], qty)
				G.on_collect(entry["id"], qty)
				G.combat_message.emit("Loot: %s x%d" % [Data.ITEMS[entry["id"]]["name"], qty], "loot")
				_spawn_drop_orb(entry["id"])
		elif entry.has("pool"):
			if randf() < entry.get("chance", 0.08):
				var pool: Array = Data.DROP_POOLS.get(entry["pool"], [])
				if pool.size() > 0:
					var item_id: String = pool[randi() % pool.size()]
					G.add_item(item_id)
					G.combat_message.emit("Loot: %s" % Data.ITEMS[item_id]["name"], "loot")
					_spawn_drop_orb(item_id)
		elif entry.has("gem"):
			if randf() < entry.get("chance", 0.03):
				var gem_id := Data.random_gem(entry["gem"])
				G.add_item(gem_id)
				G.combat_message.emit("Loot: %s" % Data.ITEMS[gem_id]["name"], "loot")
				_spawn_drop_orb(gem_id)


func _spawn_drop_orb(item_id: String) -> void:
	var def := Data.ITEMS.get(item_id, {})
	if def.is_empty():
		return
	# Quality color
	var q_col: Color = Data.QUALITY_COLORS.get(def.get("quality", "common"), Color(0.8, 0.8, 0.8))
	var orb := MeshInstance3D.new()
	var sm := SphereMesh.new(); sm.radius = 0.22; sm.height = 0.44
	orb.mesh = sm
	var mat := StandardMaterial3D.new()
	mat.albedo_color = q_col
	mat.emission_enabled = true
	mat.emission = q_col * 1.2
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	orb.material_override = mat
	var offset := Vector3(randf_range(-0.8, 0.8), 0.3, randf_range(-0.8, 0.8))
	orb.position = global_position + offset
	get_parent().add_child(orb)
	# Name label
	var lbl := Label3D.new()
	lbl.text = def.get("name", "?")
	lbl.font_size = 18
	lbl.modulate = q_col
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lbl.no_depth_test = true
	lbl.position = orb.position + Vector3(0, 0.6, 0)
	get_parent().add_child(lbl)
	# Float and fade after 8 seconds
	var tw := get_tree().create_tween()
	tw.tween_property(orb, "position:y", orb.position.y + 0.3, 1.0)
	tw.tween_interval(7.0)
	tw.tween_property(orb, "modulate:a", 0.0, 0.8)
	tw.tween_callback(orb.queue_free)
	var tw2 := get_tree().create_tween()
	tw2.tween_interval(8.0)
	tw2.tween_callback(lbl.queue_free)


func _despawn() -> void:
	queue_free()


func _pick_patrol() -> void:
	var angle := randf() * TAU
	var dist  := randf() * PATROL_RADIUS
	patrol_target = spawn_pos + Vector3(cos(angle) * dist, 0, sin(angle) * dist)


func _return_to_spawn() -> void:
	patrol_target = spawn_pos
	state = State.PATROL


func _find_player() -> Node3D:
	var players := get_tree().get_nodes_in_group("player")
	return players[0] if players.size() > 0 else null


func _update_hp_bar() -> void:
	if hp_bar_mesh:
		var pct := float(hp) / float(max_hp)
		hp_bar_mesh.mesh.size.x = 1.2 * pct
		hp_bar_mesh.position.x  = -0.6 * (1.0 - pct)


func get_stats() -> Dictionary:
	return {"atk": atk, "matk": 0, "def": def, "hp": hp, "max_hp": max_hp, "crit": 0}
