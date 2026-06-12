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
		name_label.modulate = Color(1.0, 0.55, 0.4) if is_boss else Color(1, 1, 1)
	_apply_zone_color(data)
	add_to_group("monsters")


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
	G.combat_message.emit("-%d" % actual, "damage")
	if not aggressive and state == State.IDLE:
		state = State.CHASE
	if source and player_ref == null:
		player_ref = source
	if hp <= 0:
		_die(source)


func apply_status(status_id: String, duration: float) -> void:
	statuses[status_id] = duration


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
		G.gain_xp(mob_def.get("xp", level * 14))
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

	# Dissolve after delay
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
		elif entry.has("pool"):
			if randf() < entry.get("chance", 0.08):
				var pool: Array = Data.DROP_POOLS.get(entry["pool"], [])
				if pool.size() > 0:
					var item_id: String = pool[randi() % pool.size()]
					G.add_item(item_id)
					G.combat_message.emit("Loot: %s" % Data.ITEMS[item_id]["name"], "loot")
		elif entry.has("gem"):
			if randf() < entry.get("chance", 0.03):
				var gem_id := Data.random_gem(entry["gem"])
				G.add_item(gem_id)
				G.combat_message.emit("Loot: %s" % Data.ITEMS[gem_id]["name"], "loot")


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
