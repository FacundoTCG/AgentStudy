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


func _ready() -> void:
	_load_scenes()
	_gen_noise()
	_build_terrain()
	_spawn_npcs()
	_spawn_zone_monsters()
	_spawn_stones()
	_bake_nav()

	# Spawn player
	if player_scene:
		var p := player_scene.instantiate()
		add_child(p)
		p.global_position = Vector3(0, _get_height(0, 0) + 2.0, 0)
		p.add_to_group("player")

	# Sky / environment
	_setup_environment()


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


func _bake_nav() -> void:
	if nav_region:
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

	var wenv := WorldEnvironment.new()
	wenv.environment = env
	add_child(wenv)

	# Sun
	var sun := DirectionalLight3D.new()
	sun.light_color = Color(1.0, 0.92, 0.82)
	sun.light_energy = 1.3
	sun.rotation_degrees = Vector3(-42, 30, 0)
	sun.shadow_enabled = true
	sun.shadow_bias = 0.05
	add_child(sun)

	# Ambient fill
	var fill := DirectionalLight3D.new()
	fill.light_color = Color(0.5, 0.55, 0.7)
	fill.light_energy = 0.25
	fill.rotation_degrees = Vector3(-110, -150, 0)
	fill.shadow_enabled = false
	add_child(fill)
