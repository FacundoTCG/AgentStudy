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

@onready var skill_bar       : HBoxContainer = $SkillBar
@onready var minimap_vp      : SubViewport = $MinimapContainer/MinimapViewport
@onready var minimap_cam     : Camera3D    = $MinimapContainer/MinimapViewport/MinimapCam
@onready var minimap_container: SubViewportContainer = $MinimapContainer

@onready var combat_log  : VBoxContainer = $CombatLog
@onready var notif_box   : VBoxContainer = $Notifications
@onready var status_row  : HBoxContainer = $StatusEffects

var skill_slots   : Array = []
var skill_cds_ui  : Array = []
var player_node   : Node3D = null
var minimap_dots  : Control = null
var chat_input    : LineEdit = null
var time_label    : Label   = null
var _prev_zone    : String  = ""

var _target_ref : Node = null

const CLASS_ICONS := {
	"guerriero": "⚔", "ninja": "🗡", "mago": "🔮", "sciamano": "🌿"
}


func _ready() -> void:
	add_to_group("hud_node")
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
	# Dots overlay drawn on top of the 3D minimap render
	minimap_dots = Control.new()
	minimap_dots.name = "MinimapDots"
	minimap_dots.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	minimap_dots.mouse_filter = Control.MOUSE_FILTER_IGNORE
	minimap_dots.draw.connect(func(): _draw_minimap_dots())
	minimap_container.add_child(minimap_dots)
	# Chat input and clock
	_build_chat_input()
	_build_time_label()
	# Boss kill announcements in chat
	G.mob_killed.connect(func(mid, mname, xp, gold):
		var def := Data.MONSTERS.get(mid, {})
		if def.get("boss", false):
			_add_chat_msg("[ BOSS ] %s sconfitto!" % mname, "system"))


func _process(delta: float) -> void:
	_tick_skill_cds(delta)
	_update_target()
	_update_minimap()
	_update_buffs_ui()
	_update_zone()
	_update_time_label()
	# Hide chat input if player pressed Escape
	if chat_input and chat_input.has_focus() and Input.is_action_just_pressed("ui_cancel"):
		chat_input.visible = false
		chat_input.release_focus()


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
		var slot := _make_skill_slot(i + 1, sk, skill_ids[i])
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


func _make_skill_slot(hotkey: int, sk: Dictionary, sk_id: String = "") -> PanelContainer:
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

	# Skill level badge (bottom-right)
	if sk_id != "":
		var sk_lvl := G.player_data.get("skill_lvls", {}).get(sk_id, 1)
		var lv_lbl := Label.new()
		lv_lbl.name = "LvLabel"
		lv_lbl.text = "Lv%d" % sk_lvl
		lv_lbl.add_theme_font_size_override("font_size", 8)
		lv_lbl.add_theme_color_override("font_color", Color(0.6, 0.9, 0.5))
		lv_lbl.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		lv_lbl.anchor_left = 1.0; lv_lbl.anchor_top = 1.0
		lv_lbl.offset_left = -26; lv_lbl.offset_top  = -14
		lv_lbl.offset_right = -2; lv_lbl.offset_bottom = -2
		stack.add_child(lv_lbl)

	# Tooltip with skill details
	var mp_cost := sk.get("mp", 0)
	var cd_t    := sk.get("cd", 0.0)
	var sk_name := sk.get("name", "")
	if sk_name != "":
		var kind_str := {"melee": "Corpo a corpo", "aoe": "Area", "proj": "Proiettile",
			"dash": "Scatto", "buff": "Potenziamento", "heal": "Cura"}.get(sk.get("kind",""), sk.get("kind",""))
		panel.tooltip_text = "%s\n%s\nPM: %d   CD: %.1fs" % [sk_name, kind_str, mp_cost, cd_t]

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
	if minimap_dots:
		minimap_dots.queue_redraw()


func _draw_minimap_dots() -> void:
	if minimap_dots == null or player_node == null:
		return
	var sz  := minimap_dots.size
	var ctr := sz * 0.5
	# Camera shows 200 world units wide/tall
	var sc  := sz.x / 200.0
	var pp  := player_node.global_position

	# Player — blue dot with direction tick
	minimap_dots.draw_circle(ctr, 4.5, Color(0.25, 0.7, 1.0))

	# Monsters — red (boss = larger brighter)
	for mob in get_tree().get_nodes_in_group("monsters"):
		var mp := mob.global_position
		var dx := (mp.x - pp.x) * sc
		var dz := (mp.z - pp.z) * sc
		var dp := ctr + Vector2(dx, dz)
		if not Rect2(Vector2.ZERO, sz).has_point(dp):
			continue
		var boss_flag: bool = mob.get("is_boss") == true
		var col := Color(1.0, 0.15, 0.15) if boss_flag else Color(0.9, 0.4, 0.3)
		minimap_dots.draw_circle(dp, 5.0 if boss_flag else 2.5, col)

	# NPCs — teal
	for npc in get_tree().get_nodes_in_group("npcs"):
		var np := npc.global_position
		var dx := (np.x - pp.x) * sc
		var dz := (np.z - pp.z) * sc
		var dp := ctr + Vector2(dx, dz)
		if Rect2(Vector2.ZERO, sz).has_point(dp):
			minimap_dots.draw_circle(dp, 3.0, Color(0.3, 0.9, 0.55))

	# Dungeon entrances — gold diamond
	for d in get_tree().get_nodes_in_group("dungeons"):
		var gp := d.global_position
		var dx := (gp.x - pp.x) * sc
		var dz := (gp.z - pp.z) * sc
		var dp := ctr + Vector2(dx, dz)
		if Rect2(Vector2.ZERO, sz).has_point(dp):
			minimap_dots.draw_circle(dp, 5.0, Color(1.0, 0.85, 0.2))


# ── Zone label ────────────────────────────────────────────────

func _update_zone() -> void:
	if player_node == null:
		return
	var p2 := Vector2(player_node.global_position.x, player_node.global_position.z)
	var z := Data.zone_at(p2)
	var zname := z.get("name", "")
	zone_label.text = zname
	if zname != _prev_zone and zname != "":
		_prev_zone = zname
		_show_zone_banner(zname)


func _show_zone_banner(zone_name: String) -> void:
	var banner := Label.new()
	banner.text = zone_name.to_upper()
	banner.set_anchors_preset(Control.PRESET_TOP_WIDE)
	banner.offset_top = 220; banner.offset_bottom = 265
	banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	banner.add_theme_font_size_override("font_size", 26)
	banner.add_theme_color_override("font_color", Color(1.0, 0.85, 0.4))
	banner.add_theme_color_override("font_shadow_color", Color(0.0, 0.0, 0.0, 0.7))
	banner.add_theme_constant_override("shadow_offset_x", 2)
	banner.add_theme_constant_override("shadow_offset_y", 2)
	banner.modulate.a = 0.0
	add_child(banner)
	var tw := create_tween()
	tw.tween_property(banner, "modulate:a", 1.0, 0.4)
	tw.tween_interval(2.2)
	tw.tween_property(banner, "modulate:a", 0.0, 0.7)
	tw.tween_callback(banner.queue_free)


# ── Buff icons ────────────────────────────────────────────────

func _update_buffs_ui() -> void:
	for c in status_row.get_children():
		c.queue_free()
	for b in G.buffs:
		var pc := PanelContainer.new()
		var sf := StyleBoxFlat.new()
		sf.bg_color = Color(0.08, 0.05, 0.02, 0.85)
		sf.border_color = Color(0.38, 0.23, 0.07)
		sf.set_border_width_all(1); sf.set_corner_radius_all(3)
		pc.add_theme_stylebox_override("panel", sf)
		pc.custom_minimum_size = Vector2(52, 40)
		var vb := VBoxContainer.new()
		vb.add_theme_constant_override("separation", 1)
		pc.add_child(vb)
		var name_lbl := Label.new()
		name_lbl.text = b.get("name", "")[:8]
		name_lbl.add_theme_font_size_override("font_size", 8)
		name_lbl.add_theme_color_override("font_color", Color(0.9, 0.75, 0.4))
		name_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		vb.add_child(name_lbl)
		var pb := ProgressBar.new()
		pb.min_value = 0; pb.max_value = b.get("dur", 1.0)
		pb.value = b.get("remains", 0.0)
		pb.custom_minimum_size = Vector2(44, 6)
		pb.show_percentage = false
		var pb_sf := StyleBoxFlat.new()
		pb_sf.bg_color = Color(0.3, 0.55, 0.85)
		pb_sf.set_corner_radius_all(2)
		pb.add_theme_stylebox_override("fill", pb_sf)
		var pb_bg := StyleBoxFlat.new()
		pb_bg.bg_color = Color(0.1, 0.06, 0.03)
		pb.add_theme_stylebox_override("background", pb_bg)
		vb.add_child(pb)
		var time_lbl := Label.new()
		time_lbl.text = "%.0fs" % b.get("remains", 0.0)
		time_lbl.add_theme_font_size_override("font_size", 8)
		time_lbl.add_theme_color_override("font_color", Color(0.7, 0.6, 0.4))
		time_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		vb.add_child(time_lbl)
		status_row.add_child(pc)


# ── Combat log ────────────────────────────────────────────────

func _add_combat_msg(text: String, kind: String) -> void:
	var lbl := Label.new()
	lbl.text = text
	match kind:
		"damage":  lbl.add_theme_color_override("font_color", Color(1.0, 0.55, 0.4))
		"crit":    lbl.add_theme_color_override("font_color", Color(1.0, 0.9, 0.15))
		"damage_received": lbl.add_theme_color_override("font_color", Color(1.0, 0.3, 0.3))
		"heal":    lbl.add_theme_color_override("font_color", Color(0.4, 0.9, 0.5))
		"loot":    lbl.add_theme_color_override("font_color", Color(0.9, 0.75, 0.3))
		"chat":    lbl.add_theme_color_override("font_color", Color(0.92, 0.88, 0.82))
		"system":  lbl.add_theme_color_override("font_color", Color(0.7, 0.55, 1.0))
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
	_show_levelup_flash(lvl)


func _show_levelup_flash(lvl: int) -> void:
	var overlay := ColorRect.new()
	overlay.color = Color(0.9, 0.8, 0.2, 0.0)
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(overlay)
	var tw := create_tween()
	tw.tween_property(overlay, "color:a", 0.35, 0.3)
	tw.tween_property(overlay, "color:a", 0.0, 0.6)
	tw.tween_callback(overlay.queue_free)


func show_death_overlay(respawn_secs: float) -> void:
	var overlay := ColorRect.new()
	overlay.name = "DeathOverlay"
	overlay.color = Color(0.0, 0.0, 0.0, 0.0)
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(overlay)
	var lbl := Label.new()
	lbl.text = "SEI CADUTO IN BATTAGLIA\nRespawn in %.0f secondi..." % respawn_secs
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl.vertical_alignment   = VERTICAL_ALIGNMENT_CENTER
	lbl.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	lbl.add_theme_font_size_override("font_size", 28)
	lbl.add_theme_color_override("font_color", Color(1.0, 0.3, 0.3))
	overlay.add_child(lbl)
	var tw := create_tween()
	tw.tween_property(overlay, "color:a", 0.7, 0.5)
	tw.tween_interval(respawn_secs)
	tw.tween_property(overlay, "color:a", 0.0, 0.5)
	tw.tween_callback(overlay.queue_free)


func _find_player() -> Node3D:
	var pl := get_tree().get_nodes_in_group("player")
	return pl[0] if pl.size() > 0 else null


# ── Chat ──────────────────────────────────────────────────────

func _build_chat_input() -> void:
	chat_input = LineEdit.new()
	chat_input.placeholder_text = "/ per chattare  (Invio per inviare)"
	chat_input.custom_minimum_size = Vector2(350, 30)
	chat_input.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	chat_input.anchor_top   = 1.0; chat_input.anchor_bottom = 1.0
	chat_input.offset_left  = 10;  chat_input.offset_right  = 360
	chat_input.offset_top   = -88; chat_input.offset_bottom = -58
	var sf := StyleBoxFlat.new()
	sf.bg_color = Color(0.06, 0.04, 0.02, 0.88)
	sf.border_color = Color(0.4, 0.25, 0.08)
	sf.set_border_width_all(1)
	chat_input.add_theme_stylebox_override("normal", sf)
	chat_input.add_theme_stylebox_override("focus", sf)
	chat_input.add_theme_color_override("font_color", Color(0.92, 0.84, 0.70))
	chat_input.add_theme_color_override("font_placeholder_color", Color(0.5, 0.4, 0.25))
	chat_input.add_theme_font_size_override("font_size", 12)
	chat_input.visible = false
	chat_input.text_submitted.connect(_on_chat_submit)
	add_child(chat_input)


func _on_chat_submit(text: String) -> void:
	chat_input.visible = false
	chat_input.release_focus()
	var t := text.strip_edges()
	chat_input.text = ""
	if t.length() == 0:
		return
	var pname := G.player_data.get("name", "Avventuriero")
	_add_chat_msg("[%s]: %s" % [pname, t], "chat")


func _add_chat_msg(text: String, kind: String) -> void:
	_add_combat_msg(text, kind)


func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed:
		if event.keycode == KEY_SLASH and (chat_input == null or not chat_input.has_focus()):
			if chat_input:
				chat_input.visible = true
				chat_input.grab_focus()
				chat_input.text = ""
				get_viewport().set_input_as_handled()


# ── Clock ─────────────────────────────────────────────────────

func _build_time_label() -> void:
	time_label = Label.new()
	time_label.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	time_label.anchor_left  = 1.0; time_label.anchor_right  = 1.0
	time_label.offset_left  = -196; time_label.offset_right = -6
	time_label.offset_top   = 198; time_label.offset_bottom = 218
	time_label.add_theme_color_override("font_color", Color(0.88, 0.82, 0.55))
	time_label.add_theme_font_size_override("font_size", 11)
	time_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(time_label)


func _update_time_label() -> void:
	if time_label == null:
		return
	var world := get_tree().root.get_node_or_null("Main/World")
	if world and "day_time" in world:
		var h := int(world.day_time) % 24
		var m := int((world.day_time - floor(world.day_time)) * 60)
		var period := "☀" if h >= 6 and h < 18 else "🌙"
		time_label.text = "%s %02d:%02d" % [period, h, m]
