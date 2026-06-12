extends Node3D
## World — genera terreno procedurale, zona boschi, NPC, mostri per tier.
## Usa HeightMapShape3D + MeshInstance3D per il terreno.
## NavigationRegion3D per pathfinding mob.

const CHUNK_SIZE  := 16
const TERRAIN_RES := 257   # heightmap resolution (must be 2^n+1)
const WORLD_UNITS := 3200.0
const HALF_W      := 1600.0
const HEIGHT_AMP  := 32.0
const MOB_DENSITY := 0.0025   # mob per m^2 per zona
const STONE_PER_ZONE := 2

@onready var nav_region : NavigationRegion3D = $NavigationRegion3D

var player_scene   : PackedScene = null
var monster_scene  : PackedScene = null
var npc_scene      : PackedScene = null
var stone_scene    : PackedScene = null
var drop_scene     : PackedScene = null

var noise : FastNoiseLite = null
var spawned_mobs   : Dictionary = {}
var spawned_npcs   : Dictionary = {}
var spawned_stones : Array = []

var sun_light      : DirectionalLight3D = null
var world_env_node : WorldEnvironment   = null
var day_time       : float = 8.0          # in-game hour 0–24
const DAY_DURATION   := 600.0             # real seconds per full in-game day
var respawn_timer  : float = 0.0
const RESPAWN_INTERVAL := 45.0
var stone_respawn_timer : float = 0.0
const STONE_RESPAWN_INTERVAL := 90.0


func _ready() -> void:
	_load_scenes()
	_gen_noise()
	_build_terrain()
	_build_village()
	_spawn_npcs()
	_spawn_trees()
	_spawn_zone_monsters()
	_spawn_world_bosses()
	_spawn_stones()
	_spawn_dungeon_entrances()
	_bake_nav()

	# Spawn player
	if player_scene:
		var p := player_scene.instantiate()
		add_child(p)
		p.global_position = Vector3(0, _get_height(0, 0) + 2.0, 0)
		p.add_to_group("player")
		_color_player_by_class(p)

	# Sky / environment
	_setup_environment()
	set_process(true)


func _process(delta: float) -> void:
	day_time = fmod(day_time + delta * 24.0 / DAY_DURATION, 24.0)
	_update_daynight()
	respawn_timer += delta
	if respawn_timer >= RESPAWN_INTERVAL:
		respawn_timer = 0.0
		_respawn_zone_monsters()
	stone_respawn_timer += delta
	if stone_respawn_timer >= STONE_RESPAWN_INTERVAL:
		stone_respawn_timer = 0.0
		_respawn_stones()


func _respawn_stones() -> void:
	if not stone_scene:
		return
	var live_stones := get_tree().get_nodes_in_group("stones")
	if live_stones.size() >= Data.ZONES.size() * STONE_PER_ZONE:
		return  # All stones are alive
	for zone in Data.ZONES:
		var center : Vector2 = zone["center"]
		var radius : float   = zone["radius"]
		var tier   : int     = zone["tier"]
		# Count stones in this zone
		var zone_count := 0
		for s in live_stones:
			if Vector2(s.global_position.x, s.global_position.z).distance_to(center) <= radius:
				zone_count += 1
		if zone_count >= STONE_PER_ZONE:
			continue
		# Spawn replacement stone
		var angle := randf() * TAU
		var dist  := 0.4 * radius + randf() * 0.5 * radius
		var wx    := center.x + cos(angle) * dist
		var wz    := center.y + sin(angle) * dist
		var wy    := _get_height(wx, wz)
		var node  := stone_scene.instantiate()
		add_child(node)
		node.global_position = Vector3(wx, wy, wz)
		node.setup(Data.STONE_TIERS[tier - 1], zone)
		spawned_stones.append(node)


func _respawn_zone_monsters() -> void:
	if not monster_scene:
		return
	var current_mobs := get_tree().get_nodes_in_group("monsters")
	for zone in Data.ZONES:
		var zone_c : Vector2 = zone["center"]
		var zone_r : float   = zone["radius"]
		var tier   : int     = zone["tier"]
		var mob_count := clampi(int(PI * zone_r * zone_r * MOB_DENSITY), 6, 40)
		var count := 0
		for m in current_mobs:
			if Vector2(m.global_position.x, m.global_position.z).distance_to(zone_c) <= zone_r:
				count += 1
		var need := mob_count - count
		if need <= 0:
			continue
		for _i in mini(4, need):
			var angle := randf() * TAU
			var dist  := sqrt(randf()) * zone_r
			var wx    := zone_c.x + cos(angle) * dist
			var wz    := zone_c.y + sin(angle) * dist
			var wy    := _get_height(wx, wz)
			if wy < 0.2:
				continue
			var mob_id := "mob_z%d_%d" % [tier, randi() % 8]
			if not Data.MONSTERS.has(mob_id):
				continue
			var node := monster_scene.instantiate()
			add_child(node)
			node.global_position = Vector3(wx, wy + 0.5, wz)
			node.setup(Data.MONSTERS[mob_id])


func _update_daynight() -> void:
	if sun_light == null:
		return
	# Normalize: 0=6am (dawn), 0.5=18pm (dusk), wraps through midnight
	var progress := fmod(day_time - 6.0 + 24.0, 24.0) / 24.0
	var sun_x := -sin(progress * TAU) * 90.0
	sun_light.rotation_degrees = Vector3(sun_x, 30.0, 0.0)
	var energy_norm := clampf((sin(progress * TAU) + 1.0) * 0.5, 0.0, 1.0)
	sun_light.light_energy = lerp(0.15, 1.3, energy_norm)
	if energy_norm > 0.25:
		var golden := 1.0 - abs(energy_norm - 0.5) * 2.0
		sun_light.light_color = Color(1.0, 0.82 + golden * 0.1, 0.65 + energy_norm * 0.15)
	else:
		sun_light.light_color = Color(0.35, 0.42, 0.75)  # moonlight


func _load_scenes() -> void:
	player_scene  = load("res://scenes/player.tscn")
	monster_scene = load("res://scenes/monster.tscn")
	npc_scene     = load("res://scenes/npc.tscn")
	stone_scene   = load("res://scenes/demon_stone.tscn")


func _gen_noise() -> void:
	noise = FastNoiseLite.new()
	noise.seed = 42
	noise.frequency = 0.0012
	noise.fractal_octaves = 5
	noise.fractal_lacunarity = 2.1
	noise.fractal_gain = 0.5


func _get_height(x: float, z: float) -> float:
	# Flatten village center
	var dist := Vector2(x, z).length()
	var village_flat := smoothstep(0.0, 260.0, dist)
	var h := noise.get_noise_2d(x, z) * HEIGHT_AMP
	return lerp(0.0, h, village_flat)


func _build_terrain() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)

	var step := WORLD_UNITS / float(TERRAIN_RES - 1)
	var verts := []

	# Build vertices
	for z in TERRAIN_RES:
		var row := []
		for x in TERRAIN_RES:
			var wx := x * step - HALF_W
			var wz := z * step - HALF_W
			var wy  := _get_height(wx, wz)
			# Biome color
			var zone := Data.zone_at(Vector2(wx, wz))
			var col : Color = zone.get("color", Color(0.4, 0.55, 0.3))
			# Darken peaks, lighten water
			if wy < 0.5:
				col = col.lerp(Color(0.3, 0.4, 0.55), 0.5)
			st.set_color(col)
			var n := _calc_normal(wx, wz, step * 0.5)
			st.set_normal(n)
			st.set_uv(Vector2(float(x) / TERRAIN_RES, float(z) / TERRAIN_RES))
			st.add_vertex(Vector3(wx, wy, wz))
			row.append(Vector3(wx, wy, wz))
		verts.append(row)

	# Indices
	for z in TERRAIN_RES - 1:
		for x in TERRAIN_RES - 1:
			var i00 := z * TERRAIN_RES + x
			var i10 := i00 + 1
			var i01 := i00 + TERRAIN_RES
			var i11 := i01 + 1
			st.add_index(i00); st.add_index(i01); st.add_index(i10)
			st.add_index(i10); st.add_index(i01); st.add_index(i11)

	var mesh := st.commit()

	# Visual mesh
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.95
	mi.material_override = mat
	add_child(mi)

	# Physics collider
	var st_body := StaticBody3D.new()
	var col_shape := CollisionShape3D.new()
	col_shape.shape = mesh.create_trimesh_shape()
	st_body.add_child(col_shape)
	add_child(st_body)


func _calc_normal(x: float, z: float, step: float) -> Vector3:
	var hL := _get_height(x - step, z)
	var hR := _get_height(x + step, z)
	var hD := _get_height(x, z - step)
	var hU := _get_height(x, z + step)
	return Vector3(hL - hR, 2.0, hD - hU).normalized()


func _spawn_npcs() -> void:
	if not npc_scene:
		return
	for npc_id in Data.NPCS:
		var ndata: Dictionary = Data.NPCS[npc_id]
		var p2  : Vector2 = ndata["pos"]
		var p3  := Vector3(p2.x, 0, p2.y)
		p3.y = _get_height(p3.x, p3.z) + 0.1
		var node := npc_scene.instantiate()
		add_child(node)
		node.global_position = p3
		node.setup(ndata)
		spawned_npcs[npc_id] = node


func _spawn_zone_monsters() -> void:
	if not monster_scene:
		return
	for zone in Data.ZONES:
		var center : Vector2 = zone["center"]
		var radius : float   = zone["radius"]
		var tier   : int     = zone["tier"]
		var mob_count := int(PI * radius * radius * MOB_DENSITY)
		mob_count = clampi(mob_count, 6, 40)

		# 8 mob types per zone
		for _i in mob_count:
			var angle := randf() * TAU
			var dist  := sqrt(randf()) * radius
			var wx    := center.x + cos(angle) * dist
			var wz    := center.y + sin(angle) * dist
			var wy    := _get_height(wx, wz)
			if wy < 0.2:
				continue  # no water spawns

			# Pick mob type based on tier
			var role  := randi() % 8
			var mob_id := "mob_z%d_%d" % [tier, role]
			if not Data.MONSTERS.has(mob_id):
				continue

			var node := monster_scene.instantiate()
			add_child(node)
			node.global_position = Vector3(wx, wy + 0.5, wz)
			node.setup(Data.MONSTERS[mob_id])


func _spawn_trees() -> void:
	# Scatter simple trees (cylinder trunk + sphere crown) around zones
	var tree_trunk_mat := StandardMaterial3D.new()
	tree_trunk_mat.albedo_color = Color(0.28, 0.18, 0.10)
	tree_trunk_mat.roughness = 0.9
	var rng := RandomNumberGenerator.new()
	rng.seed = 12345
	for zone in Data.ZONES:
		var center : Vector2 = zone["center"]
		var radius : float   = zone["radius"]
		var tree_count := int(PI * radius * radius * 0.003)
		tree_count = clampi(tree_count, 8, 30)
		for _i in tree_count:
			var angle := rng.randf() * TAU
			var dist  := sqrt(rng.randf()) * radius
			var wx    := center.x + cos(angle) * dist
			var wz    := center.y + sin(angle) * dist
			if Vector2(wx, wz).length() < 120.0:
				continue  # No trees in village
			var wy := _get_height(wx, wz)
			if wy < 0.4:
				continue

			var trunk_h := rng.randf_range(1.8, 3.5)
			var crown_r := rng.randf_range(0.9, 1.6)

			# Trunk
			var trunk_mesh := CylinderMesh.new()
			trunk_mesh.top_radius = 0.12; trunk_mesh.bottom_radius = 0.18
			trunk_mesh.height = trunk_h
			var trunk_mi := MeshInstance3D.new()
			trunk_mi.mesh = trunk_mesh
			trunk_mi.material_override = tree_trunk_mat
			trunk_mi.position = Vector3(wx, wy + trunk_h * 0.5, wz)
			add_child(trunk_mi)

			# Crown (zone-colored sphere)
			var zone_col: Color = zone.get("color", Color(0.2, 0.4, 0.2))
			var crown_mat := StandardMaterial3D.new()
			crown_mat.albedo_color = zone_col.lerp(Color(0.1, 0.5, 0.15), 0.5)
			crown_mat.roughness = 0.9
			var crown_mesh := SphereMesh.new()
			crown_mesh.radius = crown_r; crown_mesh.height = crown_r * 1.4
			var crown_mi := MeshInstance3D.new()
			crown_mi.mesh = crown_mesh
			crown_mi.material_override = crown_mat
			crown_mi.position = Vector3(wx, wy + trunk_h + crown_r * 0.6, wz)
			add_child(crown_mi)


func _spawn_world_bosses() -> void:
	if not monster_scene:
		return
	var boss_ids := ["boss_khan", "boss_warlord", "boss_lich", "boss_hydra", "boss_pharaoh", "boss_dragon"]
	for bid in boss_ids:
		if not Data.MONSTERS.has(bid):
			continue
		var bdata: Dictionary = Data.MONSTERS[bid]
		var zone_tier: int = bdata.get("zone", 1)
		# Find matching zone
		var target_zone: Dictionary = {}
		for z in Data.ZONES:
			if z["tier"] == zone_tier:
				target_zone = z
				break
		if target_zone.is_empty():
			continue
		var c: Vector2 = target_zone["center"]
		var r: float   = target_zone["radius"]
		var angle := randf() * TAU
		var wx := c.x + cos(angle) * r * 0.6
		var wz := c.y + sin(angle) * r * 0.6
		var wy := _get_height(wx, wz)
		if wy < 0.3:
			continue
		var node := monster_scene.instantiate()
		add_child(node)
		node.global_position = Vector3(wx, wy + 1.0, wz)
		node.setup(bdata)


func _spawn_stones() -> void:
	if not stone_scene:
		return
	for zone in Data.ZONES:
		var center : Vector2 = zone["center"]
		var radius : float   = zone["radius"]
		var tier   : int     = zone["tier"]
		var stone_def : Dictionary = Data.STONE_TIERS[tier - 1]

		for _i in STONE_PER_ZONE:
			var angle := randf() * TAU
			var dist  := 0.4 * radius + randf() * 0.5 * radius
			var wx    := center.x + cos(angle) * dist
			var wz    := center.y + sin(angle) * dist
			var wy    := _get_height(wx, wz)

			var node := stone_scene.instantiate()
			add_child(node)
			node.global_position = Vector3(wx, wy, wz)
			node.setup(stone_def, zone)
			spawned_stones.append(node)


func _build_village() -> void:
	# Procedural village buildings near center (0,0)
	var building_defs := [
		# [x, z, w, h, d, Color]  — w=width, h=height, d=depth
		[32, -58, 8.0, 6.0, 6.0, Color(0.35, 0.22, 0.12)],   # Blacksmith
		[-48, -48, 12.0, 5.0, 8.0, Color(0.42, 0.28, 0.15)], # Merchant
		[0, 68, 10.0, 5.5, 7.0, Color(0.38, 0.25, 0.14)],    # Healer
		[68, 18, 14.0, 6.0, 9.0, Color(0.28, 0.18, 0.10)],   # Tavern
		[-78, 8, 8.0, 5.0, 6.0, Color(0.34, 0.20, 0.12)],    # Barber
		[53, 52, 8.0, 5.0, 6.0, Color(0.30, 0.20, 0.14)],    # Alchemist
		[-38, 78, 9.0, 5.0, 7.0, Color(0.36, 0.22, 0.13)],   # Stable
		[83, -22, 8.0, 5.0, 6.0, Color(0.32, 0.20, 0.13)],   # Enchanter
		[-68, -38, 9.0, 5.5, 6.0, Color(0.38, 0.24, 0.14)],  # Master
		[14, -83, 8.0, 5.0, 6.0, Color(0.30, 0.19, 0.12)],   # Captain
		[-13, 88, 8.0, 5.0, 6.0, Color(0.34, 0.22, 0.13)],   # Nonna
		[-88, -13, 9.0, 5.5, 7.0, Color(0.28, 0.18, 0.12)],  # Sage
		[43, -43, 7.0, 5.0, 5.0, Color(0.33, 0.21, 0.13)],   # Explorer
		# Extra houses
		[20, 30, 7.0, 4.5, 5.0, Color(0.32, 0.21, 0.13)],
		[-25, -20, 6.0, 4.5, 5.0, Color(0.30, 0.20, 0.12)],
		[15, -25, 7.0, 4.5, 5.0, Color(0.36, 0.23, 0.14)],
		[-10, 40, 6.0, 4.5, 5.0, Color(0.31, 0.20, 0.12)],
		[40, 5, 6.0, 4.0, 5.0, Color(0.33, 0.22, 0.13)],
	]
	var roof_mat := StandardMaterial3D.new()
	roof_mat.albedo_color = Color(0.25, 0.15, 0.08)
	roof_mat.roughness = 0.9

	for bdef in building_defs:
		var bx: float = bdef[0]; var bz: float = bdef[1]
		var bw: float = bdef[2]; var bh: float = bdef[3]; var bd: float = bdef[4]
		var bcol: Color = bdef[5]
		var by: float = _get_height(bx, bz)

		# Wall mesh
		var wall_mesh := BoxMesh.new()
		wall_mesh.size = Vector3(bw, bh, bd)
		var wall_mat := StandardMaterial3D.new()
		wall_mat.albedo_color = bcol
		wall_mat.roughness = 0.85
		var wall_mi := MeshInstance3D.new()
		wall_mi.mesh = wall_mesh
		wall_mi.material_override = wall_mat
		wall_mi.position = Vector3(bx, by + bh * 0.5, bz)
		wall_mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		add_child(wall_mi)

		# Roof (slightly wider, half-height box as simple flat roof)
		var roof_mesh := BoxMesh.new()
		roof_mesh.size = Vector3(bw + 0.4, 0.35, bd + 0.4)
		var roof_mi := MeshInstance3D.new()
		roof_mi.mesh = roof_mesh
		roof_mi.material_override = roof_mat
		roof_mi.position = Vector3(bx, by + bh + 0.18, bz)
		add_child(roof_mi)

		# Collision for building walls
		var st_body := StaticBody3D.new()
		var cshape := CollisionShape3D.new()
		var box_s := BoxShape3D.new()
		box_s.size = Vector3(bw, bh, bd)
		cshape.shape = box_s
		st_body.add_child(cshape)
		st_body.position = Vector3(bx, by + bh * 0.5, bz)
		add_child(st_body)

	# Campfires with dynamic OmniLight
	var fire_positions := [Vector2(30, -12), Vector2(-38, 18), Vector2(12, 62), Vector2(-22, -58), Vector2(60, 30)]
	var log_mat_fire := StandardMaterial3D.new()
	log_mat_fire.albedo_color = Color(0.26, 0.16, 0.09); log_mat_fire.roughness = 0.9
	for fp in fire_positions:
		var fy := _get_height(fp.x, fp.y)
		var log_m := CylinderMesh.new()
		log_m.top_radius = 0.38; log_m.bottom_radius = 0.48; log_m.height = 0.25
		var log_mi := MeshInstance3D.new()
		log_mi.mesh = log_m; log_mi.material_override = log_mat_fire
		log_mi.position = Vector3(fp.x, fy + 0.13, fp.y)
		add_child(log_mi)
		var flame_m := CylinderMesh.new()
		flame_m.top_radius = 0.0; flame_m.bottom_radius = 0.22; flame_m.height = 0.45
		var flame_mat := StandardMaterial3D.new()
		flame_mat.albedo_color = Color(1.0, 0.5, 0.1, 0.85)
		flame_mat.emission_enabled = true; flame_mat.emission = Color(1.0, 0.45, 0.05) * 1.8
		flame_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		var flame_mi := MeshInstance3D.new()
		flame_mi.mesh = flame_m; flame_mi.material_override = flame_mat
		flame_mi.position = Vector3(fp.x, fy + 0.5, fp.y)
		add_child(flame_mi)
		var fire_light := OmniLight3D.new()
		fire_light.light_color = Color(1.0, 0.58, 0.18)
		fire_light.light_energy = 2.2; fire_light.omni_range = 9.0
		fire_light.shadow_enabled = false
		fire_light.position = Vector3(fp.x, fy + 0.85, fp.y)
		add_child(fire_light)

	# Central well / landmark
	var well_mat := StandardMaterial3D.new()
	well_mat.albedo_color = Color(0.55, 0.48, 0.38)
	well_mat.roughness = 0.8
	var well_mesh := CylinderMesh.new()
	well_mesh.top_radius = 0.9; well_mesh.bottom_radius = 0.9; well_mesh.height = 1.0
	var well_mi := MeshInstance3D.new()
	well_mi.mesh = well_mesh; well_mi.material_override = well_mat
	well_mi.position = Vector3(0, _get_height(0, 0) + 0.5, 0)
	add_child(well_mi)


func _color_player_by_class(p: Node3D) -> void:
	var cls := G.player_data.get("class", "guerriero")
	var cls_colors := {
		"guerriero": Color(0.75, 0.22, 0.17),
		"ninja":     Color(0.18, 0.60, 0.30),
		"mago":      Color(0.55, 0.25, 0.75),
		"sciamano":  Color(0.20, 0.50, 0.72),
	}
	var body := p.get_node_or_null("MeshRoot/Body")
	var head := p.get_node_or_null("MeshRoot/Head")
	if body:
		var mat := StandardMaterial3D.new()
		mat.albedo_color = cls_colors.get(cls, Color(0.7, 0.5, 0.3))
		mat.roughness = 0.7
		body.material_override = mat
	if head:
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.85, 0.72, 0.58)
		mat.roughness = 0.8
		head.material_override = mat


func _spawn_dungeon_entrances() -> void:
	# Portal gates between zones — two glowing pillars + vertical disc + Label3D
	var portals := [
		[Vector2( 400, -800), "Grotta dei Banditi"],
		[Vector2(-600,  400), "Bosco Maledetto"],
		[Vector2( 900,  200), "Rovine di Metin"],
		[Vector2(-300, -900), "Cripta del Re Orchetto"],
		[Vector2( 700,  700), "Torre dell'Oscurità"],
		[Vector2(-900,  600), "Vulcano Infernale"],
	]
	var pillar_mat := StandardMaterial3D.new()
	pillar_mat.albedo_color = Color(0.28, 0.18, 0.55)
	pillar_mat.emission_enabled = true
	pillar_mat.emission       = Color(0.5, 0.3, 1.0) * 0.5
	pillar_mat.roughness      = 0.4

	var disc_mat := StandardMaterial3D.new()
	disc_mat.albedo_color = Color(0.35, 0.25, 0.85, 0.7)
	disc_mat.emission_enabled = true
	disc_mat.emission    = Color(0.55, 0.4, 1.0) * 0.8
	disc_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	disc_mat.cull_mode   = BaseMaterial3D.CULL_DISABLED

	for pdef in portals:
		var c2 : Vector2 = pdef[0]
		var pname : String = pdef[1]
		var py : float = _get_height(c2.x, c2.y)

		# Two pillars flanking the portal
		for side in [-1.6, 1.6]:
			var pm := CylinderMesh.new()
			pm.top_radius = 0.38; pm.bottom_radius = 0.52; pm.height = 4.0
			var pmi := MeshInstance3D.new()
			pmi.mesh = pm; pmi.material_override = pillar_mat
			pmi.position = Vector3(c2.x + side, py + 2.0, c2.y)
			add_child(pmi)
			# Cap sphere
			var cap_m := SphereMesh.new(); cap_m.radius = 0.5; cap_m.height = 1.0
			var cap_mat := StandardMaterial3D.new()
			cap_mat.albedo_color = Color(0.7, 0.5, 1.0)
			cap_mat.emission_enabled = true
			cap_mat.emission = Color(0.8, 0.6, 1.0) * 1.2
			var cap_mi := MeshInstance3D.new()
			cap_mi.mesh = cap_m; cap_mi.material_override = cap_mat
			cap_mi.position = Vector3(c2.x + side, py + 4.5, c2.y)
			add_child(cap_mi)

		# Vertical portal disc
		var disc_m := CylinderMesh.new()
		disc_m.top_radius = 1.6; disc_m.bottom_radius = 1.6; disc_m.height = 0.08
		var disc_mi := MeshInstance3D.new()
		disc_mi.mesh = disc_m; disc_mi.material_override = disc_mat
		disc_mi.position = Vector3(c2.x, py + 2.5, c2.y)
		disc_mi.rotation_degrees = Vector3(90, 0, 0)
		add_child(disc_mi)

		# Portal name
		var lbl := Label3D.new()
		lbl.text = "⬛ %s" % pname
		lbl.font_size = 30
		lbl.modulate = Color(0.85, 0.7, 1.0)
		lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		lbl.no_depth_test = true
		lbl.position = Vector3(c2.x, py + 5.6, c2.y)
		add_child(lbl)

		# Invisible Node3D marker for minimap dot
		var marker := Node3D.new()
		marker.position = Vector3(c2.x, py, c2.y)
		marker.add_to_group("dungeons")
		add_child(marker)


func _bake_nav() -> void:
	if nav_region == null:
		return
	var nm := NavigationMesh.new()
	nm.agent_height = 1.8
	nm.agent_radius = 0.5
	nm.agent_max_climb = 0.35
	nm.agent_max_slope = 45.0
	nm.cell_size = 0.5
	nm.cell_height = 0.25
	nm.geometry_parsed_geometry_type = NavigationMesh.PARSED_GEOMETRY_STATIC_COLLIDERS
	nav_region.navigation_mesh = nm
	nav_region.bake_navigation_mesh()


func _setup_environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var proc_sky := ProceduralSkyMaterial.new()
	proc_sky.sky_top_color    = Color(0.15, 0.22, 0.38)
	proc_sky.sky_horizon_color = Color(0.45, 0.35, 0.22)
	proc_sky.ground_bottom_color = Color(0.1, 0.08, 0.06)
	proc_sky.sun_angle_max    = 30.0
	sky.sky_material = proc_sky
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.7
	env.fog_enabled = true
	env.fog_density = 0.006
	env.fog_light_color = Color(0.5, 0.45, 0.40)
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.1
	env.glow_enabled = false

	world_env_node = WorldEnvironment.new()
	world_env_node.environment = env
	add_child(world_env_node)

	# Sun
	sun_light = DirectionalLight3D.new()
	sun_light.light_color = Color(1.0, 0.92, 0.82)
	sun_light.light_energy = 1.3
	sun_light.rotation_degrees = Vector3(-42, 30, 0)
	sun_light.shadow_enabled = true
	sun_light.shadow_bias = 0.05
	add_child(sun_light)

	# Ambient fill (stays constant)
	var fill := DirectionalLight3D.new()
	fill.light_color = Color(0.5, 0.55, 0.7)
	fill.light_energy = 0.25
	fill.rotation_degrees = Vector3(-110, -150, 0)
	fill.shadow_enabled = false
	add_child(fill)
