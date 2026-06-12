extends StaticBody3D
## NPC — villager interattivo. Triggerizza il dialogo tramite Area3D di prossimità.

signal dialogue_opened(npc_id: String)

@onready var name_label    : Label3D = $NameLabel
@onready var interact_area : Area3D  = $InteractArea

var npc_id        := ""
var npc_data      : Dictionary = {}
var player_nearby := false
var quest_label   : Label3D = null
var _mesh_root    : Node3D  = null


func setup(data: Dictionary) -> void:
	npc_id   = data["id"]
	npc_data = data
	add_to_group("npcs")
	if name_label:
		name_label.text = "%s\n[%s]" % [data["name"], data["title"]]
	# Give each NPC a warm unique color so they stand out from monsters
	var body := get_node_or_null("MeshRoot/Body")
	if body:
		var idx := Data.NPCS.keys().find(npc_id)
		var npc_cols := [
			Color(0.55, 0.35, 0.18), Color(0.30, 0.22, 0.60), Color(0.22, 0.55, 0.35),
			Color(0.60, 0.48, 0.20), Color(0.45, 0.55, 0.25), Color(0.20, 0.42, 0.55),
			Color(0.55, 0.28, 0.42), Color(0.48, 0.42, 0.28), Color(0.38, 0.22, 0.55),
			Color(0.28, 0.48, 0.42), Color(0.55, 0.40, 0.22), Color(0.22, 0.38, 0.52),
			Color(0.52, 0.48, 0.30),
		]
		var mat := StandardMaterial3D.new()
		mat.albedo_color = npc_cols[clampi(idx, 0, npc_cols.size() - 1)]
		mat.roughness = 0.7
		body.material_override = mat


func _ready() -> void:
	if interact_area:
		interact_area.body_entered.connect(_on_body_enter)
		interact_area.body_exited.connect(_on_body_exit)
	_mesh_root = get_node_or_null("MeshRoot")
	_build_quest_indicator()
	set_process(true)


func _process(_delta: float) -> void:
	# Idle bob
	if _mesh_root:
		var tb := Time.get_ticks_msec() * 0.001
		_mesh_root.position.y = sin(tb * 1.1 + global_position.x * 0.3) * 0.018
	_update_quest_indicator()


func _build_quest_indicator() -> void:
	quest_label = Label3D.new()
	quest_label.font_size = 28
	quest_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	quest_label.no_depth_test = true
	quest_label.position = Vector3(0, 2.6, 0)
	quest_label.visible = false
	add_child(quest_label)


func _update_quest_indicator() -> void:
	if quest_label == null:
		return
	var services := npc_data.get("services", {})
	if not services.has("quests"):
		quest_label.visible = false
		return
	var pl_lvl := G.player_data.get("level", 1)
	var has_turnin := false
	var has_available := false
	for qid in services["quests"]:
		if G.done_quests.has(qid):
			continue
		if G.active_quests.has(qid) and G.is_quest_complete(qid):
			has_turnin = true
			break
		elif not G.active_quests.has(qid):
			var q := Data.QUESTS.get(qid, {})
			if pl_lvl >= q.get("lvl", 1):
				has_available = true
	if has_turnin:
		quest_label.text = "!"
		quest_label.modulate = Color(1.0, 0.75, 0.1)
		quest_label.visible = true
	elif has_available:
		quest_label.text = "!"
		quest_label.modulate = Color(1.0, 1.0, 1.0)
		quest_label.visible = true
	else:
		quest_label.visible = false


func _on_body_enter(body: Node) -> void:
	if body.is_in_group("player"):
		player_nearby = true
		G.notification.emit("Premi F per parlare con %s" % npc_data["name"], "info")


func _on_body_exit(body: Node) -> void:
	if body.is_in_group("player"):
		player_nearby = false


func _input(event: InputEvent) -> void:
	if player_nearby and event is InputEventKey and event.pressed:
		if event.keycode == KEY_F:
			interact()


func interact() -> void:
	G.npc_interaction.emit(npc_id)
