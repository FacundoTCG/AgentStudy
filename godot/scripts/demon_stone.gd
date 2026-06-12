extends StaticBody3D
## Pietra Demoniaca — evocatrice di mostri per tier.
## Prendi danni per distruggerla; evoca minion durante il combattimento.

@onready var name_label  : Label3D          = $NameLabel
@onready var hp_bar_mesh : MeshInstance3D   = $HPBarMesh
@onready var mesh_inst   : MeshInstance3D   = $StoneMesh
@onready var area        : Area3D           = $HitArea

var stone_name := ""
var tier       := 1
var hp         := 1000
var max_hp     := 1000
var xp         := 200
var gold_range := [50, 100]
var minion_id  := ""
var zone_data  : Dictionary = {}
var minions    : Array = []
var is_dead    := false
var player_ref : Node3D = null
var evoke_cd   := 0.0

var monster_scene : PackedScene = null


func setup(data: Dictionary, zone: Dictionary) -> void:
	stone_name = data["name"]
	tier       = data["tier"]
	hp         = data["hp"]
	max_hp     = data["hp"]
	xp         = data["xp"]
	gold_range = data["gold"]
	minion_id  = data["minion"]
	zone_data  = zone
	add_to_group("stones")
	if name_label:
		name_label.text = stone_name
	_apply_material()
	monster_scene = load("res://scenes/monster.tscn")


func _apply_material() -> void:
	if mesh_inst:
		var mat := StandardMaterial3D.new()
		# Color by tier: deep red to icy blue
		var cols := [Color(0.3, 0.05, 0.05), Color(0.3, 0.12, 0.05), Color(0.4, 0.2, 0.05),
			Color(0.25, 0.08, 0.3), Color(0.08, 0.1, 0.4), Color(0.05, 0.25, 0.3),
			Color(0.15, 0.15, 0.5), Color(0.4, 0.4, 0.6)]
		mat.albedo_color = cols[clampi(tier - 1, 0, 7)]
		mat.emission_enabled = true
		mat.emission = mat.albedo_color * 0.5
		mat.roughness = 0.6
		mat.metallic = 0.2
		mesh_inst.material_override = mat


func _physics_process(delta: float) -> void:
	if is_dead:
		return
	evoke_cd = maxf(0.0, evoke_cd - delta)
	if player_ref and evoke_cd <= 0.0 and minions.size() < 3:
		_summon_minion()
		evoke_cd = 12.0
	_update_hp_bar()


func take_damage(amount: int, source: Node3D = null) -> void:
	if is_dead:
		return
	if player_ref == null and source:
		player_ref = source
		G.notification.emit("Pietra Demoniaca attaccata!", "info")
	hp -= amount
	G.combat_message.emit("-%d" % amount, "damage")
	if hp <= 0:
		_die()


func _die() -> void:
	is_dead = true
	remove_from_group("stones")
	add_to_group("dead")
	G.gain_xp(xp)
	var gold := gold_range[0] + randi() % maxi(1, gold_range[1] - gold_range[0])
	G.gain_gold(gold)
	G.combat_message.emit("+%d oro, +%d XP" % [gold, xp], "loot")
	# Destroy minions
	for m in minions:
		if is_instance_valid(m):
			m.queue_free()
	if name_label:
		name_label.visible = false
	if mesh_inst:
		mesh_inst.visible = false
	await get_tree().create_timer(1.0).timeout
	queue_free()


func _summon_minion() -> void:
	if not Data.MONSTERS.has(minion_id) or monster_scene == null:
		return
	# Clean dead refs
	minions = minions.filter(func(m): return is_instance_valid(m))
	var offset := Vector3(randf_range(-4, 4), 0.5, randf_range(-4, 4))
	var node := monster_scene.instantiate()
	get_parent().add_child(node)
	node.global_position = global_position + offset
	node.setup(Data.MONSTERS[minion_id])
	minions.append(node)


func _update_hp_bar() -> void:
	if hp_bar_mesh:
		var pct := float(hp) / float(max_hp)
		hp_bar_mesh.mesh.size.x = 1.6 * pct
		hp_bar_mesh.position.x  = -0.8 * (1.0 - pct)


func get_stats() -> Dictionary:
	return {"def": 0, "hp": hp, "max_hp": max_hp}
