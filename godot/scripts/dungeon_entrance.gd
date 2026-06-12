extends Area3D
## DungeonEntrance — Area3D che teletrasporta il giocatore dentro/fuori un dungeon.
## Usato sia per l'ingresso (vicino ai portali) che per l'uscita (dentro la stanza).

@export var dungeon_name  : String  = ""
@export var teleport_dest : Vector3 = Vector3.ZERO
@export var is_exit       : bool    = false

var player_nearby := false
var prompt_label  : Label3D = null


func _ready() -> void:
	collision_layer = 0
	collision_mask  = 2   # player is on layer 2
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)

	var cs := CollisionShape3D.new()
	var sphere := SphereShape3D.new()
	sphere.radius = 2.8 if not is_exit else 2.0
	cs.shape = sphere
	add_child(cs)

	prompt_label = Label3D.new()
	prompt_label.billboard  = BaseMaterial3D.BILLBOARD_ENABLED
	prompt_label.no_depth_test = true
	prompt_label.font_size  = 20
	prompt_label.visible    = false
	prompt_label.position   = Vector3(0, 1.6, 0)
	if is_exit:
		prompt_label.text    = "[ F ] Esci dal dungeon"
		prompt_label.modulate = Color(0.9, 0.85, 0.5)
	else:
		prompt_label.text    = "[ F ] Entra: %s" % dungeon_name
		prompt_label.modulate = Color(0.85, 0.7, 1.0)
	add_child(prompt_label)


func _on_body_entered(body: Node) -> void:
	if body.is_in_group("player"):
		player_nearby = true
		if prompt_label:
			prompt_label.visible = true


func _on_body_exited(body: Node) -> void:
	if body.is_in_group("player"):
		player_nearby = false
		if prompt_label:
			prompt_label.visible = false


func _input(event: InputEvent) -> void:
	if not player_nearby:
		return
	if not (event is InputEventKey and event.pressed and event.keycode == KEY_F):
		return
	var players := get_tree().get_nodes_in_group("player")
	if players.is_empty():
		return
	var p : Node3D = players[0]
	p.global_position = teleport_dest
	if is_exit:
		G.notification.emit("Sei uscito dal dungeon.", "info")
	else:
		G.notification.emit("Sei entrato nel %s!" % dungeon_name, "info")
	if prompt_label:
		prompt_label.visible = false
	player_nearby = false
	get_viewport().set_input_as_handled()
