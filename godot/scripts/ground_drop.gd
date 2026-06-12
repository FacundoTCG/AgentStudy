extends Area3D
## GroundDrop — item lying on the ground. Auto-picked up when player enters,
## or fades away after LIFETIME seconds.

const LIFETIME := 60.0
const AUTO_PICKUP_RADIUS := 1.4

var item_id  : String = ""
var item_qty : int    = 1
var _timer   : float  = 0.0
var _orb     : MeshInstance3D = null
var _lbl     : Label3D        = null


func setup(id: String, qty: int, world_pos: Vector3) -> void:
	item_id  = id
	item_qty = qty
	global_position = world_pos
	add_to_group("ground_drops")

	var def := Data.ITEMS.get(id, {})
	var q_col: Color = Data.QUALITY_COLORS.get(def.get("quality", "common"), Color(0.8, 0.8, 0.8))

	# Collision sphere for pickup detection
	var coll := CollisionShape3D.new()
	var sphere := SphereShape3D.new()
	sphere.radius = AUTO_PICKUP_RADIUS
	coll.shape = sphere
	add_child(coll)
	collision_layer = 0
	collision_mask  = 2   # player layer

	# Visual orb
	_orb = MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.18; sm.height = 0.36
	_orb.mesh = sm
	var mat := StandardMaterial3D.new()
	mat.albedo_color = q_col
	mat.emission_enabled = true
	mat.emission = q_col * 1.1
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_orb.material_override = mat
	add_child(_orb)

	# Floating name label
	_lbl = Label3D.new()
	_lbl.text = def.get("name", "?") + (" x%d" % qty if qty > 1 else "")
	_lbl.font_size = 16
	_lbl.modulate = q_col
	_lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_lbl.no_depth_test = true
	_lbl.position = Vector3(0, 0.62, 0)
	add_child(_lbl)

	# Gentle bobbing tween
	var tw := create_tween().set_loops()
	tw.tween_property(_orb, "position:y", 0.22, 0.85).set_trans(Tween.TRANS_SINE)
	tw.tween_property(_orb, "position:y", 0.0,  0.85).set_trans(Tween.TRANS_SINE)

	# Rare+ quality light beacon
	if def.get("quality", "common") in ["rare", "epic", "legendary"]:
		var light := OmniLight3D.new()
		light.light_color = q_col
		light.light_energy = 0.9
		light.omni_range = 3.0
		add_child(light)

	body_entered.connect(_on_body_entered)
	set_process(true)


func _process(delta: float) -> void:
	_timer += delta
	if _timer >= LIFETIME - 8.0 and _orb and _orb.material_override:
		var remaining := LIFETIME - _timer
		_orb.material_override.albedo_color.a = clampf(remaining / 8.0, 0.0, 1.0)
		if _lbl:
			_lbl.modulate.a = clampf(remaining / 8.0, 0.0, 1.0)
	if _timer >= LIFETIME:
		queue_free()


func _on_body_entered(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	if G.add_item(item_id, item_qty):
		var def := Data.ITEMS.get(item_id, {})
		var quality := def.get("quality", "common")
		G.notification.emit("Raccolto: %s" % def.get("name", "?"), "success")
		G.item_picked_up.emit(item_id, item_qty)
		G.on_collect(item_id, item_qty)
		# Legendary drop world announcement
		if quality == "legendary":
			_announce_legendary_drop(def)
		elif quality == "epic":
			G.combat_message.emit("★ EPICO: %s!" % def.get("name", "?"), "crit")
		queue_free()
	else:
		G.notification.emit("Inventario pieno!", "error")


func _announce_legendary_drop(def: Dictionary) -> void:
	var hud_arr := get_tree().get_nodes_in_group("hud_node")
	if hud_arr.size() == 0:
		return
	var hud := hud_arr[0]
	if hud.has_method("show_legendary_announcement"):
		hud.show_legendary_announcement(def.get("name", "?"))
