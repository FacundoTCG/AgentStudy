extends StaticBody3D
## NPC — villager interattivo. Triggerizza il dialogo tramite Area3D di prossimità.

signal dialogue_opened(npc_id: String)

@onready var name_label : Label3D = $NameLabel
@onready var interact_area : Area3D = $InteractArea

var npc_id   := ""
var npc_data : Dictionary = {}
var player_nearby := false


func setup(data: Dictionary) -> void:
	npc_id   = data["id"]
	npc_data = data
	add_to_group("npcs")
	if name_label:
		name_label.text = "%s\n[%s]" % [data["name"], data["title"]]


func _ready() -> void:
	if interact_area:
		interact_area.body_entered.connect(_on_body_enter)
		interact_area.body_exited.connect(_on_body_exit)


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
