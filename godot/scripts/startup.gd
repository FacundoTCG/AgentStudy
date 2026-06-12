extends Node
## Schermata iniziale: selezione classe, nome personaggio.
## Mostra un salvataggio esistente se disponibile.

const WOOD_DARK  := Color(0.08, 0.05, 0.02)
const WOOD_MED   := Color(0.14, 0.08, 0.03)
const BORDER_COL := Color(0.38, 0.23, 0.07)
const GOLD_COL   := Color(0.85, 0.65, 0.25)
const TEXT_COL   := Color(0.92, 0.84, 0.70)
const DIM_COL    := Color(0.60, 0.50, 0.35)

var selected_class := "guerriero"
var class_buttons  := {}

@onready var name_edit  : LineEdit   = $Root/Center/Card/VBox/NameRow/NameInput
@onready var start_btn  : Button     = $Root/Center/Card/VBox/StartBtn
@onready var class_grid : GridContainer = $Root/Center/Card/VBox/ClassGrid
@onready var desc_label : Label      = $Root/Center/Card/VBox/DescLabel
@onready var save_label : Label      = $Root/Center/Card/VBox/SaveLabel


func _ready() -> void:
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	_check_existing_save()
	_build_class_buttons()
	start_btn.pressed.connect(_on_start)
	_select_class("guerriero")


func _check_existing_save() -> void:
	var sf := FileAccess.open("user://save.json", FileAccess.READ)
	if sf:
		var txt := sf.get_as_text()
		sf.close()
		var data := JSON.parse_string(txt)
		if data and data is Dictionary and data.has("player"):
			var pd: Dictionary = data["player"]
			var cls_name := Data.CLASSES.get(pd.get("class", "guerriero"), {}).get("name", "?")
			save_label.text = "Salvataggio trovato: %s  Lv %d  —  Premi INIZIA per continuare" % [
				pd.get("name", "?"), pd.get("level", 1)]
			save_label.modulate = Color(0.6, 0.9, 0.6)
			return
	save_label.text = "Nessun salvataggio. Crea il tuo personaggio."
	save_label.modulate = DIM_COL


func _build_class_buttons() -> void:
	var cls_defs := [
		["guerriero", "⚔", "Guerriero", "Forza e resistenza.\nScudo e spada in prima linea."],
		["ninja",     "🗡", "Ninja",     "Velocità e critici letali.\nVeleni e doppie lame."],
		["mago",      "🔮", "Mago Oscuro", "Magie devastanti.\nArea e drenaggio vitale."],
		["sciamano",  "🌿", "Sciamano",  "Spiriti e fulmini.\nCure e benedizioni."],
	]
	for cd in cls_defs:
		var cls_key: String = cd[0]
		var btn := Button.new()
		btn.custom_minimum_size = Vector2(130, 90)
		btn.text = "%s\n%s" % [cd[1], cd[2]]
		btn.add_theme_font_size_override("font_size", 13)
		_style_class_btn(btn, false)
		btn.pressed.connect(_select_class.bind(cls_key))
		class_buttons[cls_key] = {"btn": btn, "desc": cd[3]}
		class_grid.add_child(btn)


func _style_class_btn(btn: Button, selected: bool) -> void:
	var sf := StyleBoxFlat.new()
	sf.bg_color      = Color(0.22, 0.12, 0.04) if selected else Color(0.12, 0.07, 0.03)
	sf.border_color  = GOLD_COL if selected else BORDER_COL
	sf.set_border_width_all(2 if selected else 1)
	sf.set_corner_radius_all(5)
	btn.add_theme_stylebox_override("normal",  sf)
	var sf_h := sf.duplicate()
	sf_h.bg_color = Color(0.26, 0.15, 0.06)
	sf_h.border_color = GOLD_COL
	btn.add_theme_stylebox_override("hover", sf_h)
	btn.add_theme_color_override("font_color", GOLD_COL if selected else TEXT_COL)


func _select_class(cls_key: String) -> void:
	selected_class = cls_key
	for key in class_buttons.keys():
		var entry: Dictionary = class_buttons[key]
		_style_class_btn(entry["btn"], key == cls_key)
	desc_label.text = class_buttons[cls_key]["desc"]


func _on_start() -> void:
	var pname := name_edit.text.strip_edges()
	if pname.length() < 2:
		pname = "Avventuriero"
	# Store in G so main.gd can read it (save load has priority)
	G.pending_class = selected_class
	G.pending_name  = pname
	get_tree().change_scene_to_file("res://scenes/main.tscn")
