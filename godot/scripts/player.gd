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
var _target_ring : MeshInstance3D = null
var move_target  : Vector3 = Vector3.ZERO
var using_nav    := false

var hp_regen_t  := 0.0
var mp_regen_t  := 0.0
var weapon_holder  : Node3D = null
var mount_visual   : Node3D = null
var pet_visual     : Node3D = null
var active_statuses : Dictionary = {}   # sid → remaining_time
var auto_heal_on    := true             # auto-drink HP potion when below threshold
var auto_pot_cd     := 0.0             # cooldown between auto-pots
var is_sprinting    := false
const SPRINT_MULT     := 1.65
const SPRINT_MP_DRAIN := 8.0           # MP/s while sprinting

var combo_count := 0
var combo_timer := 0.0
const COMBO_WINDOW := 1.8              # seconds between hits to keep chain
const COMBO_FINISHER_MULT := 1.9       # damage multiplier on 3rd hit


func _ready() -> void:
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	cam_arm.spring_length = cam_dist
	cam_arm.rotation.x = -cam_pitch
	if G.player_data.is_empty():
		G.init_player("guerriero", "Avventuriero")
	G.recalc_stats()
	_update_name_label()
	G.player_stats_changed.connect(_on_stats_changed)
	G.level_up.connect(_on_level_up)
	G.pet_changed.connect(_update_pet_visual)
	# Sync HP/MP from data
	G.player_data["hp"]    = G.player_data["max_hp"]
	G.player_data["mp"]    = G.player_data["max_mp"]
	# Create weapon visual holder
	weapon_holder = Node3D.new()
	weapon_holder.name = "WeaponHolder"
	mesh_root.add_child(weapon_holder)
	_update_weapon_visual()


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
	if G.stall_active:
		velocity = Vector3.ZERO
		move_and_slide()
		return

	_tick_cooldowns(delta)
	_tick_regen(delta)
	_tick_statuses(delta)
	_update_target_ring()
	_update_pet_follow(delta)
	G.tick_buffs(delta)

	var pd := G.player_data
	var spd: float = pd.get("speed", 9.0)

	# ── Sprint ─────────────────────────────────────────────────
	var shift_held := Input.is_key_pressed(KEY_SHIFT)
	var was_sprinting := is_sprinting
	if shift_held and pd.get("mp", 0) > 0 and not active_statuses.has("stun") and not active_statuses.has("root"):
		is_sprinting = true
		var mp_cost := int(SPRINT_MP_DRAIN * delta)
		if mp_cost > 0:
			pd["mp"] = maxi(0, pd["mp"] - mp_cost)
			G.player_stats_changed.emit()
		spd *= SPRINT_MULT
	else:
		is_sprinting = false
	if was_sprinting != is_sprinting:
		G.player_stats_changed.emit()

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
	combo_count += 1
	combo_timer = COMBO_WINDOW
	var is_finisher := combo_count >= 3
	var mult := COMBO_FINISHER_MULT if is_finisher else 1.0
	var dmg := G.calc_damage(pd, target_mob.get_stats(), mult)
	target_mob.take_damage(dmg, self)
	if is_finisher:
		combo_count = 0
		G.combat_message.emit("COMBO! -%d" % dmg, "crit")
	elif G.last_crit:
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
	# U: toggle auto-potion
	if event is InputEventKey and event.pressed and event.keycode == KEY_U:
		auto_heal_on = not auto_heal_on
		G.notification.emit("Auto-pozione: %s" % ("ON" if auto_heal_on else "OFF"), "info")
		get_viewport().set_input_as_handled()
	# G: fishing
	if event is InputEventKey and event.pressed and event.keycode == KEY_G:
		var fish_arr := get_tree().get_nodes_in_group("fishing_system")
		if fish_arr.size() > 0:
			fish_arr[0].handle_input()
		get_viewport().set_input_as_handled()
	# P: toggle PvP mode
	if event is InputEventKey and event.pressed and event.keycode == KEY_P:
		G.toggle_pvp()
		get_viewport().set_input_as_handled()
	# T: stall toggle
	if event is InputEventKey and event.pressed and event.keycode == KEY_T:
		if G.stall_active:
			G.close_stall()
		else:
			var ui_arr := get_tree().get_nodes_in_group("ui_node")
			if ui_arr.size() > 0:
				ui_arr[0].call("_show_panel", "stall")
		get_viewport().set_input_as_handled()
	# O: guild panel
	if event is InputEventKey and event.pressed and event.keycode == KEY_O:
		var ui_arr := get_tree().get_nodes_in_group("ui_node")
		if ui_arr.size() > 0:
			ui_arr[0].call("_toggle_panel", "guild")
		get_viewport().set_input_as_handled()


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
	_flash_skill_slot(index)
	_spawn_skill_effect(sk)

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
	_spawn_projectile_visual(target_mob)
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


func _spawn_projectile_visual(target: Node3D) -> void:
	if not is_instance_valid(target):
		return
	var proj := MeshInstance3D.new()
	var sm := SphereMesh.new(); sm.radius = 0.16; sm.height = 0.32
	proj.mesh = sm
	var cls_cols := {"guerriero": Color(0.85, 0.65, 0.2), "ninja": Color(0.3, 0.9, 0.45),
		"mago": Color(0.55, 0.3, 0.95), "sciamano": Color(0.3, 0.75, 0.95)}
	var col := cls_cols.get(G.player_data.get("class", "guerriero"), Color(1.0, 0.8, 0.3))
	var mat := StandardMaterial3D.new()
	mat.albedo_color = col
	mat.emission_enabled = true
	mat.emission = col * 1.4
	proj.material_override = mat
	var start_pos := global_position + Vector3(0, 1.2, 0)
	proj.position = start_pos
	get_parent().add_child(proj)
	var dest := target.global_position + Vector3(0, 1.0, 0)
	var tw := get_tree().create_tween()
	tw.tween_property(proj, "position", dest, 0.22)
	tw.tween_property(proj, "scale", Vector3(0.05, 0.05, 0.05), 0.08)
	tw.tween_callback(proj.queue_free)


func _show_heal_number(amount: int) -> void:
	var lbl := Label3D.new()
	lbl.text = "+%d" % amount
	lbl.font_size = 17
	lbl.modulate = Color(0.3, 0.95, 0.45)
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lbl.no_depth_test = true
	lbl.position = global_position + Vector3(randf_range(-0.4, 0.4), 2.2, 0)
	get_parent().add_child(lbl)
	var tw := get_tree().create_tween()
	tw.tween_property(lbl, "position:y", lbl.position.y + 1.0, 1.1)
	tw.parallel().tween_property(lbl, "modulate:a", 0.0, 1.1)
	tw.tween_callback(lbl.queue_free)


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


func apply_status(sid: String, dur: float) -> void:
	active_statuses[sid] = dur
	var icons := {"poison": "☠", "slow": "❄", "stun": "⭐", "root": "🌿", "weaken": "💀"}
	G.notification.emit("Stato: %s (%s)" % [sid.capitalize(), icons.get(sid, "?")], "error")


func _tick_statuses(delta: float) -> void:
	var to_rem := []
	for sid in active_statuses.keys():
		active_statuses[sid] -= delta
		if sid == "poison" and Engine.get_frames_drawn() % 90 == 0:
			var pd := G.player_data
			var dmg := maxi(1, int(pd["max_hp"] * 0.015))
			pd["hp"] = maxi(0, pd["hp"] - dmg)
			G.combat_message.emit("☠ -%d (veleno)" % dmg, "damage_received")
			G.player_stats_changed.emit()
		if active_statuses[sid] <= 0.0:
			to_rem.append(sid)
	for sid in to_rem:
		active_statuses.erase(sid)


func _tick_cooldowns(delta: float) -> void:
	atk_cd = maxf(0.0, atk_cd - delta)
	pot_cd = maxf(0.0, pot_cd - delta)
	for i in 8:
		skill_cds[i] = maxf(0.0, skill_cds[i] - delta)
	if combo_count > 0:
		combo_timer -= delta
		if combo_timer <= 0.0:
			combo_count = 0


func _tick_regen(delta: float) -> void:
	var pd := G.player_data
	hp_regen_t += delta
	mp_regen_t += delta
	# Auto-potion
	auto_pot_cd = maxf(0.0, auto_pot_cd - delta)
	if auto_heal_on and auto_pot_cd <= 0.0:
		var hp_pct := float(pd["hp"]) / float(pd["max_hp"])
		if hp_pct < 0.30:
			for i in G.INV_SIZE:
				var inst := G.inventory[i]
				if inst == null:
					continue
				var def := Data.ITEMS.get(inst["id"], {})
				if def.get("kind") == "potion" and def.get("stat") == "hp":
					G.use_item_at(i)
					auto_pot_cd = 3.5
					break
	if hp_regen_t >= 4.0:
		hp_regen_t = 0.0
		var regen := maxi(1, int(pd["max_hp"] * 0.01))
		if pd.get("regen_bonus", 0) > 0:
			regen += pd["regen_bonus"]
		if pd["hp"] < pd["max_hp"]:
			pd["hp"] = mini(pd["hp"] + regen, pd["max_hp"])
			G.player_stats_changed.emit()
			if get_parent() != null:
				_show_heal_number(regen)
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
		var tag_str := G.guild_tag + " " if G.guild_tag != "" else ""
		var pvp_str := " ⚔" if G.pvp_mode else ""
		name_label.text = "%s%s  Lv %d%s" % [tag_str, G.player_data.get("name","?"), G.player_data.get("level",1), pvp_str]


func _on_stats_changed() -> void:
	_update_name_label()
	_update_weapon_visual()
	_update_mount_visual()


func _on_level_up(new_level: int) -> void:
	_spawn_levelup_pillar()


func _spawn_levelup_pillar() -> void:
	var parent := get_parent()
	if parent == null:
		return
	var base_pos := global_position

	# Golden rising column
	var pillar_mesh := CylinderMesh.new()
	pillar_mesh.top_radius = 0.35; pillar_mesh.bottom_radius = 0.55; pillar_mesh.height = 14.0
	var pillar_mat := StandardMaterial3D.new()
	pillar_mat.albedo_color = Color(1.0, 0.92, 0.25, 0.55)
	pillar_mat.emission_enabled = true
	pillar_mat.emission = Color(1.0, 0.85, 0.1) * 1.6
	pillar_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	pillar_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	var pillar := MeshInstance3D.new()
	pillar.mesh = pillar_mesh
	pillar.material_override = pillar_mat
	pillar.position = base_pos + Vector3(0, 7.0, 0)
	parent.add_child(pillar)

	# Inner bright core
	var core_mesh := CylinderMesh.new()
	core_mesh.top_radius = 0.12; core_mesh.bottom_radius = 0.2; core_mesh.height = 14.0
	var core_mat := StandardMaterial3D.new()
	core_mat.albedo_color = Color(1.0, 1.0, 0.9, 0.9)
	core_mat.emission_enabled = true
	core_mat.emission = Color(1.0, 0.98, 0.7) * 2.8
	core_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	core_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	var core := MeshInstance3D.new()
	core.mesh = core_mesh
	core.material_override = core_mat
	core.position = base_pos + Vector3(0, 7.0, 0)
	parent.add_child(core)

	# Burst particles
	var sparks := CPUParticles3D.new()
	sparks.emitting = true; sparks.one_shot = true
	sparks.amount = 60; sparks.lifetime = 1.8; sparks.explosiveness = 0.9
	sparks.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	sparks.emission_sphere_radius = 0.6
	sparks.initial_velocity_min = 4.0; sparks.initial_velocity_max = 10.0
	sparks.gravity = Vector3(0, 1, 0)
	sparks.scale_amount_min = 0.06; sparks.scale_amount_max = 0.18
	sparks.color = Color(1.0, 0.9, 0.25)
	sparks.position = base_pos + Vector3(0, 1.0, 0)
	parent.add_child(sparks)

	# Ground ring glow
	var ring_m := TorusMesh.new()
	ring_m.inner_radius = 0.7; ring_m.outer_radius = 1.2
	var ring_mat := StandardMaterial3D.new()
	ring_mat.albedo_color = Color(1.0, 0.9, 0.2, 0.7)
	ring_mat.emission_enabled = true
	ring_mat.emission = Color(1.0, 0.85, 0.1) * 1.2
	ring_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ring_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	var ring := MeshInstance3D.new()
	ring.mesh = ring_m; ring.material_override = ring_mat
	ring.position = base_pos + Vector3(0, 0.06, 0)
	parent.add_child(ring)

	# Animate: pillar rises then fades, ring expands and fades
	var tw := get_tree().create_tween()
	tw.tween_property(pillar, "modulate:a", 0.0, 2.2)
	tw.tween_callback(pillar.queue_free)

	var tw2 := get_tree().create_tween()
	tw2.tween_property(core, "modulate:a", 0.0, 2.0)
	tw2.tween_callback(core.queue_free)

	var tw3 := get_tree().create_tween()
	tw3.tween_property(ring, "scale", Vector3(3.5, 3.5, 3.5), 1.6)
	tw3.parallel().tween_property(ring, "modulate:a", 0.0, 1.6)
	tw3.tween_callback(ring.queue_free)

	get_tree().create_timer(2.5).timeout.connect(sparks.queue_free)


func _update_weapon_visual() -> void:
	if weapon_holder == null:
		return
	for c in weapon_holder.get_children():
		c.queue_free()
	var wpn_inst := G.equipped.get("weapon")
	if wpn_inst == null:
		return
	var def := Data.ITEMS.get(wpn_inst["id"], {})
	var cls := G.player_data.get("class", "guerriero")
	var mesh_obj : Mesh = null
	var color := Color(0.75, 0.62, 0.38)
	match cls:
		"guerriero":
			var bm := BoxMesh.new(); bm.size = Vector3(0.07, 0.95, 0.05)
			mesh_obj = bm; color = Color(0.72, 0.58, 0.32)
		"ninja":
			var bm := BoxMesh.new(); bm.size = Vector3(0.05, 0.58, 0.04)
			mesh_obj = bm; color = Color(0.55, 0.62, 0.65)
		"mago":
			var cm := CylinderMesh.new()
			cm.top_radius = 0.04; cm.bottom_radius = 0.07; cm.height = 1.1
			mesh_obj = cm; color = Color(0.55, 0.3, 0.8)
		"sciamano":
			var sm := SphereMesh.new(); sm.radius = 0.20; sm.height = 0.4
			mesh_obj = sm; color = Color(0.3, 0.7, 0.55)
	if mesh_obj == null:
		return
	var mi := MeshInstance3D.new()
	mi.mesh = mesh_obj
	var mat := StandardMaterial3D.new()
	var enh := wpn_inst.get("enh", 0)
	if enh >= 7:
		mat.albedo_color = Color(0.9, 0.85, 0.2)  # gold glow for high enhance
		mat.emission_enabled = true
		mat.emission = Color(1.0, 0.9, 0.3) * 0.4
	elif enh >= 4:
		mat.albedo_color = Color(0.7, 0.75, 0.85)  # silver glow
	else:
		mat.albedo_color = color
	mat.metallic = 0.55; mat.roughness = 0.35
	mi.material_override = mat
	mi.position = Vector3(0.4, 0.86, 0.0)
	weapon_holder.add_child(mi)


func _update_mount_visual() -> void:
	if mount_visual:
		mount_visual.queue_free()
		mount_visual = null
	if not G.mount_active:
		return
	# Find mount color from inventory or equipped
	var mount_col := Color(0.45, 0.30, 0.18)
	for i in G.INV_SIZE:
		var inst := G.inventory[i]
		if inst and Data.ITEMS.get(inst["id"], {}).get("kind") == "mount":
			mount_col = Data.ITEMS[inst["id"]].get("color", mount_col)
			break
	mount_visual = Node3D.new()
	mount_visual.name = "MountVisual"
	var body_mat := StandardMaterial3D.new()
	body_mat.albedo_color = mount_col; body_mat.roughness = 0.75
	# Body
	var bm := BoxMesh.new(); bm.size = Vector3(0.6, 0.52, 1.1)
	var bmi := MeshInstance3D.new(); bmi.mesh = bm; bmi.material_override = body_mat
	bmi.position = Vector3(0, -0.48, 0)
	mount_visual.add_child(bmi)
	# Head
	var hm := SphereMesh.new(); hm.radius = 0.22; hm.height = 0.44
	var hmi := MeshInstance3D.new(); hmi.mesh = hm; hmi.material_override = body_mat
	hmi.position = Vector3(0, -0.16, 0.62)
	mount_visual.add_child(hmi)
	# Legs
	var leg_mat := StandardMaterial3D.new()
	leg_mat.albedo_color = mount_col.darkened(0.28); leg_mat.roughness = 0.8
	for lx in [-0.22, 0.22]:
		for lz in [-0.38, 0.34]:
			var lm := CylinderMesh.new()
			lm.top_radius = 0.07; lm.bottom_radius = 0.05; lm.height = 0.5
			var lmi := MeshInstance3D.new(); lmi.mesh = lm; lmi.material_override = leg_mat
			lmi.position = Vector3(lx, -0.88, lz)
			mount_visual.add_child(lmi)
	add_child(mount_visual)


func _update_pet_visual() -> void:
	if pet_visual:
		pet_visual.queue_free()
		pet_visual = null
	if G.active_pet == "":
		return
	var def := Data.ITEMS.get(G.active_pet, {})
	var col : Color = def.get("color", Color(0.6, 0.45, 0.25))
	var body_mat := StandardMaterial3D.new()
	body_mat.albedo_color = col; body_mat.roughness = 0.75

	pet_visual = Node3D.new()
	pet_visual.name = "PetVisual"
	# Body
	var bm := SphereMesh.new(); bm.radius = 0.26; bm.height = 0.52
	var bmi := MeshInstance3D.new(); bmi.mesh = bm; bmi.material_override = body_mat
	bmi.position = Vector3(0, 0.30, 0)
	pet_visual.add_child(bmi)
	# Head
	var hm := SphereMesh.new(); hm.radius = 0.16; hm.height = 0.32
	var hmi := MeshInstance3D.new(); hmi.mesh = hm; hmi.material_override = body_mat
	hmi.position = Vector3(0, 0.52, 0.18)
	pet_visual.add_child(hmi)
	# Ears
	var ear_mat := StandardMaterial3D.new()
	ear_mat.albedo_color = col.darkened(0.3); ear_mat.roughness = 0.8
	for ex in [-0.09, 0.09]:
		var em := BoxMesh.new(); em.size = Vector3(0.06, 0.12, 0.04)
		var emi := MeshInstance3D.new(); emi.mesh = em; emi.material_override = ear_mat
		emi.position = Vector3(ex, 0.66, 0.16)
		pet_visual.add_child(emi)
	# Tail
	var tm := BoxMesh.new(); tm.size = Vector3(0.05, 0.05, 0.22)
	var tmi := MeshInstance3D.new(); tmi.mesh = tm; tmi.material_override = ear_mat
	tmi.position = Vector3(0, 0.34, -0.28)
	pet_visual.add_child(tmi)
	# Name label
	var lbl := Label3D.new()
	lbl.text = def.get("name", "Pet")
	lbl.font_size = 14
	lbl.modulate = Data.QUALITY_COLORS.get(def.get("quality", "common"), Color(0.85, 0.8, 0.7))
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lbl.no_depth_test = true
	lbl.position = Vector3(0, 0.95, 0)
	pet_visual.add_child(lbl)

	get_parent().add_child(pet_visual)
	pet_visual.global_position = global_position + Vector3(1.2, 0.0, 1.2)


func _update_pet_follow(delta: float) -> void:
	if pet_visual == null or not is_instance_valid(pet_visual):
		return
	var follow_target := global_position + Vector3(1.1, 0.0, 1.1)
	var dist := pet_visual.global_position.distance_to(follow_target)
	# Teleport if too far behind (e.g. dopo un teletrasporto)
	if dist > 25.0:
		pet_visual.global_position = follow_target
		return
	if dist > 0.6:
		var bob := sin(Time.get_ticks_msec() * 0.008) * 0.06
		var goal := Vector3(follow_target.x, global_position.y + bob, follow_target.z)
		pet_visual.global_position = pet_visual.global_position.lerp(goal, minf(6.0 * delta, 1.0))
		# Face movement direction
		var flat := follow_target - pet_visual.global_position
		flat.y = 0
		if flat.length() > 0.3:
			pet_visual.look_at(pet_visual.global_position + flat, Vector3.UP)


func get_stats() -> Dictionary:
	return G.player_data


func _update_target_ring() -> void:
	var valid_target := is_instance_valid(target_mob) and target_mob.has_method("take_damage")
	if not valid_target:
		if is_instance_valid(_target_ring):
			_target_ring.queue_free()
		_target_ring = null
		return
	# Create ring if missing
	if not is_instance_valid(_target_ring):
		_target_ring = MeshInstance3D.new()
		var mesh := TorusMesh.new()
		mesh.inner_radius = 0.55; mesh.outer_radius = 0.70
		_target_ring.mesh = mesh
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(1.0, 0.25, 0.15, 0.75)
		mat.emission_enabled = true
		mat.emission = Color(1.0, 0.3, 0.1) * 0.5
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.cull_mode = BaseMaterial3D.CULL_DISABLED
		_target_ring.material_override = mat
		get_parent().add_child(_target_ring)
	# Track position
	var tp := target_mob.global_position
	_target_ring.global_position = Vector3(tp.x, tp.y + 0.06, tp.z)
	_target_ring.scale = target_mob.scale * 1.1


func _flash_skill_slot(index: int) -> void:
	var huds := get_tree().get_nodes_in_group("hud_node")
	if huds.size() > 0 and huds[0].has_method("flash_skill"):
		huds[0].flash_skill(index)


func _spawn_skill_effect(sk: Dictionary) -> void:
	var cls := G.player_data.get("class", "guerriero")
	var kind := sk.get("kind", "melee")
	# Color by class
	var colors := {"guerriero": Color(0.95, 0.55, 0.15), "ninja": Color(0.25, 0.90, 0.40),
		"mago": Color(0.55, 0.30, 1.00), "sciamano": Color(0.30, 0.80, 0.95)}
	var col := colors.get(cls, Color(1.0, 0.85, 0.3))

	var particles := CPUParticles3D.new()
	particles.emitting = true
	particles.one_shot = true
	particles.explosiveness = 0.85
	particles.lifetime = 0.55
	particles.amount = 28 if kind in ["aoe", "buff"] else 14
	particles.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	particles.emission_sphere_radius = 0.5
	particles.gravity = Vector3(0, 2, 0)
	particles.initial_velocity_min = 3.0
	particles.initial_velocity_max = 7.0
	particles.scale_amount_min = 0.08
	particles.scale_amount_max = 0.22
	particles.color = col
	match kind:
		"aoe":
			particles.emission_sphere_radius = 1.8
			particles.amount = 42
		"buff":
			col = Color(0.9, 0.95, 0.35)
			particles.color = col
			particles.gravity = Vector3(0, 5, 0)
		"heal":
			col = Color(0.25, 0.95, 0.45)
			particles.color = col
			particles.gravity = Vector3(0, 6, 0)
			particles.amount = 20
		"dash":
			particles.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
			particles.emission_box_extents = Vector3(0.3, 0.5, 0.8)
	particles.global_position = global_position + Vector3(0, 1.0, 0)
	get_parent().add_child(particles)
	var tw := get_tree().create_tween()
	tw.tween_interval(1.5)
	tw.tween_callback(particles.queue_free)
