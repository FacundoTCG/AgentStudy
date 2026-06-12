extends CharacterBody3D
## Player — controller giocatore in terza persona.
## Movimento WASD, telecamera orbitante, combattimento click/tastiera,
## abilità 1-8, pozione Q, cavalcatura R.

const GRAVITY      := 18.0
const ACCEL        := 28.0
const DECEL        := 22.0
const ROT_SPEED    := 10.0
const CAM_SENS     := 0.003
const CAM_MIN_DIST := 3.0
const CAM_MAX_DIST := 18.0
const CAM_MIN_ELEV := -0.3
const CAM_MAX_ELEV := 1.1
const ATK_RANGE    := 3.2
const ATK_CD       := 0.9

# ── Nodes ──────────────────────────────────────────────────────
@onready var mesh_root   : Node3D     = $MeshRoot
@onready var cam_arm     : SpringArm3D= $CameraArm
@onready var camera      : Camera3D   = $CameraArm/Camera3D
@onready var area_melee  : Area3D     = $MeleeArea
@onready var anim        : AnimationPlayer = $MeshRoot/AnimationPlayer
@onready var name_label  : Label3D    = $NameLabel

# ── State ──────────────────────────────────────────────────────
var cam_yaw   := 0.0
var cam_pitch := 0.4
var cam_dist  := 8.0

var atk_cd    := 0.0
var skill_cds := [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
var pot_cd    := 0.0

var target_mob   : Node3D = null
var is_dead      := false
var move_target  : Vector3 = Vector3.ZERO
var using_nav    := false

var hp_regen_t  := 0.0
var mp_regen_t  := 0.0


func _ready() -> void:
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	cam_arm.spring_length = cam_dist
	cam_arm.rotation.x = -cam_pitch
	if G.player_data.is_empty():
		G.init_player("guerriero", "Avventuriero")
	G.recalc_stats()
	_update_name_label()
	G.player_stats_changed.connect(_on_stats_changed)
	# Sync HP/MP from data
	G.player_data["hp"]    = G.player_data["max_hp"]
	G.player_data["mp"]    = G.player_data["max_mp"]


func _input(event: InputEvent) -> void:
	# Camera rotation — right mouse drag
	if event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
		cam_yaw   -= event.relative.x * CAM_SENS
		cam_pitch  = clampf(cam_pitch + event.relative.y * CAM_SENS, CAM_MIN_ELEV, CAM_MAX_ELEV)
		cam_arm.rotation.x = -cam_pitch

	# Camera zoom
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			cam_dist = clampf(cam_dist - 1.0, CAM_MIN_DIST, CAM_MAX_DIST)
			cam_arm.spring_length = cam_dist
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			cam_dist = clampf(cam_dist + 1.0, CAM_MIN_DIST, CAM_MAX_DIST)
			cam_arm.spring_length = cam_dist

	# Left-click: attack target or move
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if not get_viewport().gui_get_focus_owner():
			_handle_left_click(event.position)


func _handle_left_click(screen_pos: Vector2) -> void:
	var ray_len := 200.0
	var from := camera.project_ray_origin(screen_pos)
	var to   := from + camera.project_ray_normal(screen_pos) * ray_len
	var space := get_world_3d().direct_space_state
	var params := PhysicsRayQueryParameters3D.create(from, to)
	params.collision_mask = 0b1111
	var result := space.intersect_ray(params)
	if result.is_empty():
		return
	var hit := result["collider"]
	# If hit a mob
	if hit.is_in_group("monsters"):
		target_mob = hit.get_parent() if not hit.has_method("take_damage") else hit
		if is_instance_valid(target_mob) and target_mob.has_method("take_damage"):
			G.notification.emit("Bersaglio: %s Lv %d" % [target_mob.mob_name, target_mob.level], "info")
		return
	# If hit a stone
	if hit.is_in_group("stones"):
		target_mob = hit.get_parent() if hit.get_parent().has_method("take_damage") else hit
		return
	# If hit NPC
	if hit.is_in_group("npcs"):
		var npc_node := hit.get_parent()
		if npc_node.has_method("interact"):
			npc_node.interact()
		return
	# Otherwise: click-to-move
	if result.has("position"):
		move_target = result["position"]
		using_nav   = true
		target_mob  = null


func _physics_process(delta: float) -> void:
	if is_dead:
		return

	_tick_cooldowns(delta)
	_tick_regen(delta)
	G.tick_buffs(delta)

	var pd := G.player_data
	var spd: float = pd.get("speed", 9.0)

	# ── Movement ───────────────────────────────────────────────
	var input_dir := Vector2.ZERO
	if Input.is_action_pressed("move_forward"):  input_dir.y -= 1
	if Input.is_action_pressed("move_back"):     input_dir.y += 1
	if Input.is_action_pressed("move_left"):     input_dir.x -= 1
	if Input.is_action_pressed("move_right"):    input_dir.x += 1

	if input_dir.length() > 0.1:
		using_nav = false
		target_mob = null if not _auto_attack_active() else target_mob

	var wish_vel := Vector3.ZERO

	if input_dir.length() > 0.1:
		var cam_fwd := Vector3(-sin(cam_yaw), 0, -cos(cam_yaw))
		var cam_rgt := Vector3(cos(cam_yaw), 0, -sin(cam_yaw))
		wish_vel = (cam_fwd * -input_dir.y + cam_rgt * input_dir.x).normalized() * spd
	elif using_nav and move_target.distance_to(global_position) > 0.5:
		var dir := (move_target - global_position)
		dir.y = 0
		wish_vel = dir.normalized() * spd
		if move_target.distance_to(global_position) < 0.5:
			using_nav = false

	# Smooth acceleration
	if wish_vel.length() > 0.1:
		velocity.x = move_toward(velocity.x, wish_vel.x, ACCEL * delta)
		velocity.z = move_toward(velocity.z, wish_vel.z, ACCEL * delta)
		# Rotate mesh toward movement direction
		var move_dir := Vector2(wish_vel.x, wish_vel.z)
		if move_dir.length() > 0.1:
			var target_angle := atan2(move_dir.x, move_dir.y)
			mesh_root.rotation.y = lerp_angle(mesh_root.rotation.y, target_angle, ROT_SPEED * delta)
	else:
		velocity.x = move_toward(velocity.x, 0.0, DECEL * delta)
		velocity.z = move_toward(velocity.z, 0.0, DECEL * delta)

	# Gravity
	if not is_on_floor():
		velocity.y -= GRAVITY * delta
	else:
		velocity.y = -0.5

	# Rotate arm horizontally
	cam_arm.rotation.y = cam_yaw
	global_position.y = maxf(global_position.y, _get_terrain_height(global_position))

	move_and_slide()

	# Animation
	var is_moving := velocity.length() > 0.5
	if anim:
		var anim_name := "run" if is_moving else "idle"
		if anim.has_animation(anim_name) and anim.current_animation != anim_name:
			anim.play(anim_name)

	# Mesh bob (simulates run/idle animation without AnimationPlayer tracks)
	if mesh_root:
		var t_bob := Time.get_ticks_msec() * 0.001
		mesh_root.position.y = sin(t_bob * (7.0 if is_moving else 1.5)) * (0.05 if is_moving else 0.022)

	# Auto-attack loop
	if is_instance_valid(target_mob) and target_mob.has_method("take_damage"):
		var dist := global_position.distance_to(target_mob.global_position)
		if dist <= ATK_RANGE + 0.5 and atk_cd <= 0.0:
			_perform_attack()
		elif dist > ATK_RANGE + 0.5:
			# Walk toward target
			var dir := (target_mob.global_position - global_position)
			dir.y = 0
			if dir.length() > 0.01:
				velocity.x = dir.normalized().x * spd
				velocity.z = dir.normalized().z * spd


func _auto_attack_active() -> bool:
	return is_instance_valid(target_mob) and target_mob.has_method("take_damage") and not target_mob.is_in_group("dead")


func _perform_attack() -> void:
	var pd := G.player_data
	var dmg := G.calc_damage(pd, target_mob.get_stats())
	target_mob.take_damage(dmg, self)
	if G.last_crit:
		G.combat_message.emit("CRITICO! -%d" % dmg, "crit")
	atk_cd = ATK_CD
	if anim and anim.has_animation("attack"):
		anim.play("attack")


func _unhandled_input(event: InputEvent) -> void:
	if is_dead:
		return
	# Skills 1-8
	for i in 8:
		if Input.is_action_just_pressed("skill_%d" % (i + 1)):
			use_skill(i)
	# Potion Q
	if Input.is_action_just_pressed("use_potion"):
		G.use_potion()
	# Mount R
	if Input.is_action_just_pressed("toggle_mount"):
		_toggle_mount()
	# Tab: cycle target
	if Input.is_action_just_pressed("target_nearest"):
		_target_nearest()


func use_skill(index: int) -> void:
	var pd := G.player_data
	if skill_cds[index] > 0.0:
		return
	var cls_data: Dictionary = Data.CLASSES[pd["class"]]
	var skill_ids: Array = cls_data["skills"]
	if index >= skill_ids.size():
		return
	var sk: Dictionary = Data.SKILLS[skill_ids[index]]
	if pd["mp"] < sk["mp"]:
		G.notification.emit("PM insufficienti!", "error")
		return
	pd["mp"] -= sk["mp"]
	skill_cds[index] = sk["cd"]

	# Skill level damage bonus (+8% per livello)
	var sk_lvl: int = pd["skill_lvls"].get(sk["id"], 1)
	var sk_mult: float = sk.get("mult", 1.0) * (1.0 + (sk_lvl - 1) * 0.08)
	var uses_matk: bool = sk.get("uses", "atk") == "matk"

	match sk["kind"]:
		"melee":
			if is_instance_valid(target_mob) and target_mob.has_method("take_damage"):
				var hits: int = sk.get("hits", 1)
				for _h in hits:
					var dmg := G.calc_damage(pd, target_mob.get_stats(), sk_mult, uses_matk)
					target_mob.take_damage(dmg, self)
					if sk.has("status"):
						target_mob.apply_status(sk["status"], sk.get("status_dur", 2.0))
		"aoe":
			_cast_aoe(sk, sk_mult, uses_matk)
		"proj":
			_cast_projectile(sk, sk_mult, uses_matk)
		"dash":
			_cast_dash(sk, sk_mult, uses_matk)
		"buff":
			_apply_buff(sk)
		"heal":
			var heal := int(pd["max_hp"] * sk.get("pct", 0.25))
			pd["hp"] = mini(pd["hp"] + heal, pd["max_hp"])
			G.combat_message.emit("+%d PV" % heal, "heal")

	G.player_stats_changed.emit()


func _cast_aoe(sk: Dictionary, mult: float, uses_matk: bool) -> void:
	var radius: float = sk.get("radius", 4.0)
	var pd := G.player_data
	var origin := global_position
	_show_aoe_ring(origin, radius)
	for body in get_tree().get_nodes_in_group("monsters"):
		if body.global_position.distance_to(origin) <= radius and body.has_method("take_damage"):
			var dmg := G.calc_damage(pd, body.get_stats(), mult, uses_matk)
			body.take_damage(dmg, self)
			if sk.has("status"):
				body.apply_status(sk["status"], sk.get("status_dur", 2.0))


func _show_aoe_ring(pos: Vector3, radius: float) -> void:
	# Visual ring on ground for AoE skills
	var cyl := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius    = radius
	mesh.bottom_radius = radius
	mesh.height        = 0.08
	mesh.rings         = 1
	cyl.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.85, 0.2, 0.55)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.cull_mode    = BaseMaterial3D.CULL_DISABLED
	cyl.material_override = mat
	cyl.position = Vector3(pos.x, pos.y + 0.05, pos.z)
	get_parent().add_child(cyl)
	var tw := get_tree().create_tween()
	tw.tween_property(cyl, "scale", Vector3(1.2, 1.0, 1.2), 0.25)
	tw.tween_property(cyl, "modulate:a", 0.0, 0.35)
	tw.tween_callback(cyl.queue_free)


func _cast_projectile(sk: Dictionary, mult: float, uses_matk: bool) -> void:
	if not is_instance_valid(target_mob):
		return
	var chain_left: int = sk.get("chain", 1)
	var pd := G.player_data
	var current := target_mob
	var hit_set := [current]
	while chain_left > 0 and is_instance_valid(current) and current.has_method("take_damage"):
		var dmg := G.calc_damage(pd, current.get_stats(), mult, uses_matk)
		current.take_damage(dmg, self)
		if sk.has("status"):
			current.apply_status(sk["status"], sk.get("status_dur", 2.0))
		chain_left -= 1
		# Chain: find next nearby mob
		if chain_left > 0:
			var next: Node3D = null
			var min_d := 8.0
			for body in get_tree().get_nodes_in_group("monsters"):
				if body in hit_set:
					continue
				var d: float = body.global_position.distance_to(current.global_position)
				if d < min_d and body.has_method("take_damage"):
					min_d = d
					next = body
			if next:
				hit_set.append(next)
				current = next
			else:
				break


func _cast_dash(sk: Dictionary, mult: float, uses_matk: bool) -> void:
	var dist: float = sk.get("dist", 7.0)
	var fwd := Vector3(-sin(cam_yaw), 0, -cos(cam_yaw))
	global_position += fwd * dist
	if is_instance_valid(target_mob) and target_mob.has_method("take_damage"):
		var pd := G.player_data
		var dmg := G.calc_damage(pd, target_mob.get_stats(), mult, uses_matk)
		target_mob.take_damage(dmg, self)


func _apply_buff(sk: Dictionary) -> void:
	var stat: String = sk.get("stat", "atk_pct")
	var val: float   = sk.get("val", 20)
	var dur: float   = sk.get("dur", 10.0)
	# Remove existing same-stat buff
	G.buffs = G.buffs.filter(func(b): return b["stat"] != stat)
	G.buffs.append({"stat": stat, "val": val, "dur": dur, "remains": dur, "name": sk["name"]})
	G.recalc_stats()
	G.notification.emit("%s attivato!" % sk["name"], "success")


func _toggle_mount() -> void:
	if G.mount_active:
		G.mount_active = false
		G.recalc_stats()
		G.notification.emit("Cavalcatura rimessa in stalla.", "info")
		return
	# Find mount in inventory
	for i in G.INV_SIZE:
		if G.inventory[i] and Data.ITEMS[G.inventory[i]["id"]].get("kind") == "mount":
			G.mount_active = true
			G.recalc_stats()
			var mn: String = Data.ITEMS[G.inventory[i]["id"]]["name"]
			G.notification.emit("%s evocata!" % mn, "success")
			return
	# Check equipped
	if G.equipped.has("mount"):
		G.mount_active = true
		G.recalc_stats()
		return
	G.notification.emit("Nessuna cavalcatura nell'inventario.", "error")


func _target_nearest() -> void:
	var best : Node3D = null
	var best_d := 40.0
	for body in get_tree().get_nodes_in_group("monsters"):
		if not body.has_method("take_damage"):
			continue
		var d: float = global_position.distance_to(body.global_position)
		if d < best_d:
			best_d = d
			best = body
	target_mob = best
	if best:
		G.notification.emit("Bersaglio: %s" % best.mob_name, "info")


func take_damage(amount: int) -> void:
	var pd := G.player_data
	var actual := maxi(1, amount - int(pd["def"] * 0.4))
	pd["hp"] = maxi(0, pd["hp"] - actual)
	_show_damage_number(actual)
	G.combat_message.emit("-%d" % actual, "damage_received")
	G.player_stats_changed.emit()
	if pd["hp"] <= 0:
		_die()


func _show_damage_number(amount: int) -> void:
	var lbl := Label3D.new()
	lbl.text = "-%d" % amount
	lbl.font_size = 24
	lbl.modulate = Color(1.0, 0.2, 0.2)
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lbl.no_depth_test = true
	lbl.position = global_position + Vector3(randf_range(-0.3, 0.3), 2.4, 0)
	get_parent().add_child(lbl)
	var tw := get_tree().create_tween()
	tw.tween_property(lbl, "position:y", lbl.position.y + 1.5, 1.0)
	tw.parallel().tween_property(lbl, "modulate:a", 0.0, 1.0)
	tw.tween_callback(lbl.queue_free)


func _die() -> void:
	is_dead = true
	G.player_data["deaths"] += 1
	G.player_data["gold"] = maxi(0, G.player_data["gold"] - G.player_data["gold"] / 10)
	G.notification.emit("Sei caduto in battaglia!", "error")
	# Show death overlay on HUD
	var hud_arr := get_tree().get_nodes_in_group("hud_node")
	if hud_arr.size() > 0 and hud_arr[0].has_method("show_death_overlay"):
		hud_arr[0].show_death_overlay(4.0)
	get_tree().create_timer(4.0).timeout.connect(_respawn)


func _respawn() -> void:
	is_dead = false
	global_position = Vector3(0, 2, 0)
	G.player_data["hp"] = G.player_data["max_hp"]
	G.player_data["mp"] = G.player_data["max_mp"]
	G.player_stats_changed.emit()


func _tick_cooldowns(delta: float) -> void:
	atk_cd = maxf(0.0, atk_cd - delta)
	pot_cd = maxf(0.0, pot_cd - delta)
	for i in 8:
		skill_cds[i] = maxf(0.0, skill_cds[i] - delta)


func _tick_regen(delta: float) -> void:
	var pd := G.player_data
	hp_regen_t += delta
	mp_regen_t += delta
	if hp_regen_t >= 4.0:
		hp_regen_t = 0.0
		var regen := maxi(1, int(pd["max_hp"] * 0.01))
		if pd.get("regen_bonus", 0) > 0:
			regen += pd["regen_bonus"]
		pd["hp"] = mini(pd["hp"] + regen, pd["max_hp"])
		G.player_stats_changed.emit()
	if mp_regen_t >= 3.0:
		mp_regen_t = 0.0
		var regen := maxi(1, int(pd["max_mp"] * 0.015))
		pd["mp"] = mini(pd["mp"] + regen, pd["max_mp"])
		G.player_stats_changed.emit()


func _get_terrain_height(pos: Vector3) -> float:
	var space := get_world_3d().direct_space_state
	var from := Vector3(pos.x, 200.0, pos.z)
	var to   := Vector3(pos.x, -50.0, pos.z)
	var params := PhysicsRayQueryParameters3D.create(from, to)
	params.collision_mask = 1
	params.exclude = [self]
	var r := space.intersect_ray(params)
	return r["position"].y if not r.is_empty() else 0.0


func _update_name_label() -> void:
	if name_label:
		name_label.text = "%s  Lv %d" % [G.player_data["name"], G.player_data["level"]]


func _on_stats_changed() -> void:
	_update_name_label()


func get_stats() -> Dictionary:
	return G.player_data
