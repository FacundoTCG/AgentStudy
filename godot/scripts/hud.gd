extends CanvasLayer
## HUD — barre HP/MP/XP, skill bar, minimap, log di combattimento, notifiche.
## Stile visivo Metin2: pannelli in legno scuro, bordi oro.

# ── Riferimenti nodi ─────────────────────────────────────────
@onready var hp_bar    : ProgressBar = $PlayerFrame/VBox/HRow/Bars/HPRow/HPBar
@onready var mp_bar    : ProgressBar = $PlayerFrame/VBox/HRow/Bars/MPRow/MPBar
@onready var xp_bar    : ProgressBar = $PlayerFrame/VBox/XPBar
@onready var hp_label  : Label = $PlayerFrame/VBox/HRow/Bars/HPRow/HPLabel
@onready var mp_label  : Label = $PlayerFrame/VBox/HRow/Bars/MPRow/MPLabel
@onready var xp_label  : Label = $PlayerFrame/VBox/XPLabel
@onready var name_label: Label = $PlayerFrame/VBox/HRow/Bars/NameLabel
@onready var lv_label  : Label = $PlayerFrame/VBox/LevelBadge
@onready var gold_label: Label = $GoldLabel
@onready var zone_label: Label = $ZoneLabel
@onready var portrait  : Label = $PlayerFrame/VBox/HRow/Portrait

@onready var target_frame  : PanelContainer = $TargetFrame
@onready var target_name_lb: Label = $TargetFrame/VBox/TargetName
@onready var target_lv_lb  : Label = $TargetFrame/VBox/TargetLevel
@onready var target_hp_bar : ProgressBar = $TargetFrame/VBox/TargetHP

@onready var skill_bar   : HBoxContainer = $SkillBar
@onready var minimap_vp  : SubViewport = $MinimapContainer/MinimapViewport
@onready var minimap_cam : Camera3D    = $MinimapContainer/MinimapViewport/MinimapCam

@onready var combat_log  : VBoxContainer = $CombatLog
@onready var notif_box   : VBoxContainer = $Notifications
@onready var status_row  : HBoxContainer = $StatusEffects

var skill_slots : Array = []
var skill_cds_ui: Array = []
var player_node : Node3D = null

var _target_ref : Node = null

const CLASS_ICONS := {
	"guerriero": "⚔", "ninja": "🗡", "mago": "🔮", "sciamano": "🌿"
}


func _ready() -> void:
	G.player_stats_changed.connect(_update_hud)
	G.combat_message.connect(_add_combat_msg)
	G.notification.connect(_show_notif)
	G.level_up.connect(_on_level_up)
	target_frame.visible = false
	_build_skill_bar()
	_update_hud()
	# Share the main 3D world with the minimap SubViewport
	if minimap_vp:
		minimap_vp.world_3d = get_viewport().world_3d


func _process(delta: float) -> void:
	_tick_skill_cds(delta)
	_update_target()
	_update_minimap()
	_update_buffs_ui()
	_update_zone()


# ── Player HUD ────────────────────────────────────────────────

func _update_hud() -> void:
	var pd := G.player_data
	if pd.is_empty():
		return

	hp_bar.max_value = pd["max_hp"]
	hp_bar.value     = pd["hp"]
	mp_bar.max_value = pd["max_mp"]
	mp_bar.value     = pd["mp"]
	xp_bar.max_value = Data.level_xp(pd["level"])
	xp_bar.value     = pd["xp"]

	hp_label.text = "%d / %d" % [pd["hp"], pd["max_hp"]]
	mp_label.text = "%d / %d" % [pd["mp"], pd["max_mp"]]
	xp_label.text = "Lv %d" % pd["level"]
	lv_label.text = "Lv %d" % pd["level"]
	name_label.text = pd.get("name", "—")
	gold_label.text  = "◈ %s" % _fmt_gold(pd.get("gold", 0))
	portrait.text    = CLASS_ICONS.get(pd.get("class", "guerriero"), "⚔")


func _fmt_gold(g: int) -> String:
	if g >= 1000000:
		return "%.1fM" % (g / 1000000.0)
	if g >= 1000:
		return "%dk" % (g / 1000)
	return str(g)


# ── Skill bar ─────────────────────────────────────────────────

func _build_skill_bar() -> void:
	for child in skill_bar.get_children():
		child.queue_free()
	skill_slots = []
	skill_cds_ui = []

	var pd := G.player_data
	if pd.is_empty():
		return
	var cls: Dictionary = Data.CLASSES.get(pd.get("class", "guerriero"), {})
	if cls.is_empty():
		return
	var skill_ids: Array = cls.get("skills", [])

	for i in skill_ids.size():
		var sk: Dictionary = Data.SKILLS.get(skill_ids[i], {})
		var slot := _make_skill_slot(i + 1, sk)
		skill_bar.add_child(slot)
		skill_slots.append(slot)
		skill_cds_ui.append(slot.get_node("CDOverlay"))

	# Separator
	var sep := VSeparator.new()
	sep.add_theme_constant_override("separation", 10)
	skill_bar.add_child(sep)

	# Potion slot
	var pot_slot := _make_skill_slot(-1, {"name": "Pozione", "mp": 0, "cd": 3.0})
	pot_slot.name = "PotionSlot"
	skill_bar.add_child(pot_slot)


func _make_skill_slot(hotkey: int, sk: Dictionary) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(58, 58)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.12, 0.07, 0.03)
	style.border_color = Color(0.36, 0.22, 0.08)
	style.set_border_width_all(2)
	style.corner_radius_top_left = 4
	style.corner_radius_top_right = 4
	style.corner_radius_bottom_left = 4
	style.corner_radius_bottom_right = 4
	panel.add_theme_stylebox_override("panel", style)
	panel.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND

	var stack := Control.new()
	stack.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	panel.add_child(stack)

	# Icon label (emoji / text)
	var icon_lbl := Label.new()
	icon_lbl.text = sk.get("icon", "✦") if sk.has("icon") else _skill_icon(sk.get("name", ""))
	icon_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	icon_lbl.vertical_alignment   = VERTICAL_ALIGNMENT_CENTER
	icon_lbl.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	icon_lbl.add_theme_font_size_override("font_size", 26)
	stack.add_child(icon_lbl)

	# Hotkey label
	var key_lbl := Label.new()
	key_lbl.text = "Q" if hotkey < 0 else str(hotkey)
	key_lbl.add_theme_font_size_override("font_size", 9)
	key_lbl.add_theme_color_override("font_color", Color(0.6, 0.45, 0.2))
	key_lbl.set_anchors_preset(Control.PRESET_TOP_LEFT)
	key_lbl.offset_left = 3; key_lbl.offset_top = 2
	stack.add_child(key_lbl)

	# CD overlay
	var cd_overlay := ColorRect.new()
	cd_overlay.name = "CDOverlay"
	cd_overlay.color = Color(0, 0, 0, 0.72)
	cd_overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	cd_overlay.visible = false
	stack.add_child(cd_overlay)

	# CD label
	var cd_lbl := Label.new()
	cd_lbl.name = "CDLabel"
	cd_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	cd_lbl.vertical_alignment   = VERTICAL_ALIGNMENT_CENTER
	cd_lbl.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	cd_lbl.add_theme_font_size_override("font_size", 14)
	cd_lbl.add_theme_color_override("font_color", Color.WHITE)
	cd_overlay.add_child(cd_lbl)

	return panel


func _skill_icon(name: String) -> String:
	var icons := {"Fendente": "⚔", "Carica": "🏃", "Grido": "📣", "Spaccaossa": "💥",
		"Muro": "🛡", "Terremoto": "🌋", "Furia": "😡", "Pugnalata": "🗡",
		"Raffica": "⚡", "Passo": "💨", "Lama": "☠", "Lancio": "🌀",
		"Fumogena": "💨", "Danza": "🌪", "Assassinio": "💀", "Dardo": "🔮",
		"Sfera": "🔥", "Nova": "❄", "Drenaggio": "💜", "Scudo": "🌟",
		"Catena": "⚡", "Maledizione": "🌑", "Meteorite": "☄", "Scossa": "🌿",
		"Fulmine": "⚡", "Cura": "💚", "Benedizione": "✨", "Totem": "🏮",
		"Radici": "🌿", "Tempesta": "🌪", "Ira": "🌩", "Pozione": "🧪"}
	for k in icons.keys():
		if name.begins_with(k):
			return icons[k]
	return "✦"


func _tick_skill_cds(delta: float) -> void:
	if player_node == null:
		player_node = _find_player()
	if player_node == null:
		return
	for i in skill_cds_ui.size():
		var overlay: ColorRect = skill_cds_ui[i]
		if overlay == null:
			continue
		var cd_val := player_node.skill_cds[i] if i < player_node.skill_cds.size() else 0.0
		overlay.visible = cd_val > 0.01
		if overlay.visible:
			var lbl: Label = overlay.get_node_or_null("CDLabel")
			if lbl:
				lbl.text = "%.1f" % cd_val


# ── Target frame ──────────────────────────────────────────────

func _update_target() -> void:
	if player_node == null:
		player_node = _find_player()
	if player_node == null:
		return
	var t := player_node.target_mob
	if t and is_instance_valid(t) and t.has_method("get_stats"):
		_target_ref = t
		target_frame.visible = true
		target_name_lb.text = t.mob_name if t.has_method("get_stats") else "?"
		target_lv_lb.text   = "Lv %d" % t.level if t.get("level") else ""
		var s := t.get_stats()
		target_hp_bar.max_value = s.get("max_hp", 100)
		target_hp_bar.value     = s.get("hp", 0)
	else:
		target_frame.visible = false
		_target_ref = null


# ── Minimap ───────────────────────────────────────────────────

func _update_minimap() -> void:
	if minimap_cam == null or player_node == null:
		return
	var p := player_node.global_position
	minimap_cam.global_position = Vector3(p.x, p.y + 150.0, p.z)


# ── Zone label ────────────────────────────────────────────────

func _update_zone() -> void:
	if player_node == null:
		return
	var p2 := Vector2(player_node.global_position.x, player_node.global_position.z)
	var z := Data.zone_at(p2)
	zone_label.text = z.get("name", "")


# ── Buff icons ────────────────────────────────────────────────

func _update_buffs_ui() -> void:
	for c in status_row.get_children():
		c.queue_free()
	for b in G.buffs:
		var lbl := Label.new()
		lbl.text = "%s\n%.0fs" % [b.get("name", ""), b.get("remains", 0.0)]
		lbl.add_theme_font_size_override("font_size", 9)
		lbl.add_theme_color_override("font_color", Color(0.9, 0.75, 0.4))
		status_row.add_child(lbl)


# ── Combat log ────────────────────────────────────────────────

func _add_combat_msg(text: String, kind: String) -> void:
	var lbl := Label.new()
	lbl.text = text
	match kind:
		"damage":  lbl.add_theme_color_override("font_color", Color(1.0, 0.55, 0.4))
		"damage_received": lbl.add_theme_color_override("font_color", Color(1.0, 0.3, 0.3))
		"heal":    lbl.add_theme_color_override("font_color", Color(0.4, 0.9, 0.5))
		"loot":    lbl.add_theme_color_override("font_color", Color(0.9, 0.75, 0.3))
		_:         lbl.add_theme_color_override("font_color", Color(0.8, 0.8, 0.8))
	lbl.add_theme_font_size_override("font_size", 12)
	combat_log.add_child(lbl)
	# Limit to 12 entries
	if combat_log.get_child_count() > 12:
		combat_log.get_child(0).queue_free()
	# Auto-fade
	var t := get_tree().create_timer(6.0)
	t.timeout.connect(func(): if is_instance_valid(lbl): lbl.queue_free())


# ── Notifications ─────────────────────────────────────────────

func _show_notif(text: String, kind: String) -> void:
	var lbl := Label.new()
	lbl.text = text
	var colors := {"info": Color(0.6, 0.8, 1.0), "success": Color(0.5, 1.0, 0.6),
		"error": Color(1.0, 0.45, 0.4), "levelup": Color(1.0, 0.85, 0.3)}
	lbl.add_theme_color_override("font_color", colors.get(kind, Color.WHITE))
	lbl.add_theme_font_size_override("font_size", 14 if kind == "levelup" else 12)
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	notif_box.add_child(lbl)
	var t := get_tree().create_timer(3.0)
	t.timeout.connect(func():
		if is_instance_valid(lbl):
			var tw := create_tween()
			tw.tween_property(lbl, "modulate:a", 0.0, 0.5)
			tw.tween_callback(lbl.queue_free))


func _on_level_up(lvl: int) -> void:
	_build_skill_bar()   # Rebuild in case new skills unlocked


func _find_player() -> Node3D:
	var pl := get_tree().get_nodes_in_group("player")
	return pl[0] if pl.size() > 0 else null
