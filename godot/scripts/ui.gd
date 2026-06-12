extends CanvasLayer
## UI — pannelli: inventario, personaggio, missioni, mappa, dialogo NPC,
## negozio, potenziamento, alchimia, menu ESC.
## Tutti i pannelli usano il tema brown/gold stile Metin2.

const WOOD_DARK  := Color(0.10, 0.06, 0.02)
const WOOD_MED   := Color(0.14, 0.08, 0.03)
const BORDER_COL := Color(0.38, 0.23, 0.07)
const GOLD_COL   := Color(0.85, 0.65, 0.25)
const TEXT_COL   := Color(0.92, 0.84, 0.70)
const DIM_COL    := Color(0.60, 0.50, 0.35)

var panels := {}          # name → Control
var current_panel := ""
var dialogue_npc   := ""
var shop_npc_id    := ""

# ── Forge state ────────────────────────────────────────────────
var forge_selected_slot := -1

# ── Alchemy state ──────────────────────────────────────────────
var alchemy_selected_gem := ""


func _ready() -> void:
	G.npc_interaction.connect(_on_npc_interact)
	G.inventory_changed.connect(_refresh_open_panel)
	G.quest_updated.connect(_on_quest_update)
	_build_all_panels()


func _input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed:
		return
	match event.keycode:
		KEY_I: _toggle_panel("inventory")
		KEY_C: _toggle_panel("character")
		KEY_J: _toggle_panel("quests")
		KEY_M: _toggle_panel("map")
		KEY_H: _toggle_panel("achievements")


# ══════════════════ PANEL FRAMEWORK ═══════════════════════════

func _make_panel(title: String, w: float, h: float) -> PanelContainer:
	var pc := PanelContainer.new()
	pc.custom_minimum_size = Vector2(w, h)
	pc.set_anchors_preset(Control.PRESET_CENTER)
	var sf := StyleBoxFlat.new()
	sf.bg_color = WOOD_DARK
	sf.border_color = BORDER_COL
	sf.set_border_width_all(2)
	sf.set_corner_radius_all(6)
	sf.content_margin_left = 0; sf.content_margin_right = 0
	sf.content_margin_top  = 0; sf.content_margin_bottom = 0
	pc.add_theme_stylebox_override("panel", sf)
	pc.visible = false

	var vbox := VBoxContainer.new()
	vbox.name = "VBox"
	pc.add_child(vbox)

	# Header
	var header := PanelContainer.new()
	header.name = "Header"
	var hstyle := StyleBoxFlat.new()
	hstyle.bg_color = WOOD_MED
	hstyle.border_color = BORDER_COL
	hstyle.border_width_bottom = 2
	hstyle.set_corner_radius_all(0)
	header.add_theme_stylebox_override("panel", hstyle)
	var hrow := HBoxContainer.new()
	hrow.name = "TitleRow"
	header.add_child(hrow)
	var title_lbl := Label.new()
	title_lbl.name = "Title"
	title_lbl.text = title.to_upper()
	title_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title_lbl.add_theme_color_override("font_color", GOLD_COL)
	title_lbl.add_theme_font_size_override("font_size", 13)
	hrow.add_child(title_lbl)
	var close_btn := Button.new()
	close_btn.text = "✕"
	close_btn.flat = true
	close_btn.add_theme_color_override("font_color", DIM_COL)
	close_btn.pressed.connect(func(): _close_panel())
	hrow.add_child(close_btn)
	vbox.add_child(header)

	# Content area
	var scroll := ScrollContainer.new()
	scroll.name = "Scroll"
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_child(scroll)

	add_child(pc)
	return pc


func _wood_label(text: String, size: int = 12, color: Color = TEXT_COL) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	return l


func _wood_button(text: String) -> Button:
	var b := Button.new()
	b.text = text
	var sf := StyleBoxFlat.new()
	sf.bg_color = Color(0.18, 0.10, 0.04)
	sf.border_color = BORDER_COL
	sf.set_border_width_all(1)
	sf.set_corner_radius_all(3)
	b.add_theme_stylebox_override("normal", sf)
	var sf_h := sf.duplicate()
	sf_h.bg_color = Color(0.26, 0.15, 0.05)
	sf_h.border_color = GOLD_COL
	b.add_theme_stylebox_override("hover", sf_h)
	b.add_theme_color_override("font_color", TEXT_COL)
	return b


func _section_label(text: String) -> Label:
	return _wood_label(text, 10, DIM_COL)


func _separator() -> HSeparator:
	var s := HSeparator.new()
	s.add_theme_color_override("color", BORDER_COL)
	return s


# ══════════════════ PANEL CONSTRUCTION ═══════════════════════

func _build_all_panels() -> void:
	_build_inventory_panel()
	_build_character_panel()
	_build_quest_panel()
	_build_map_panel()
	_build_forge_panel()
	_build_alchemy_panel()
	_build_dialogue()
	_build_shop_panel()
	_build_achievements_panel()
	_build_esc_menu()


# ── Inventario ────────────────────────────────────────────────

func _build_inventory_panel() -> void:
	var pc := _make_panel("Inventario", 460, 580)
	panels["inventory"] = pc
	var scroll := pc.get_node("VBox/Scroll")
	var inner := VBoxContainer.new()
	inner.name = "Inner"
	inner.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(inner)

	# Equipment 3×3
	inner.add_child(_section_label("  EQUIPAGGIAMENTO"))
	var eq_grid := GridContainer.new()
	eq_grid.name = "EqGrid"
	eq_grid.columns = 3
	eq_grid.add_theme_constant_override("h_separation", 5)
	eq_grid.add_theme_constant_override("v_separation", 5)
	for slot in Data.EQUIP_SLOTS:
		var btn := _make_item_slot()
		btn.name = "eq_%s" % slot
		btn.tooltip_text = slot.capitalize()
		btn.pressed.connect(_on_equip_slot_press.bind(slot))
		eq_grid.add_child(btn)
	var eq_pad := PanelContainer.new()
	var eq_style := StyleBoxEmpty.new()
	eq_pad.add_theme_stylebox_override("panel", eq_style)
	eq_pad.add_child(eq_grid)
	inner.add_child(eq_pad)
	inner.add_child(_section_label("  STATISTICHE"))
	var stats_grid := GridContainer.new()
	stats_grid.name = "StatsGrid"
	stats_grid.columns = 2
	stats_grid.add_theme_constant_override("h_separation", 4)
	stats_grid.add_theme_constant_override("v_separation", 3)
	for stat_name in ["ATK", "MATK", "DIF", "PV", "PM", "CRT", "VEL"]:
		var lbl_k := _wood_label(stat_name + ":", 11, DIM_COL)
		var lbl_v := _wood_label("—", 11, GOLD_COL)
		lbl_v.name = "stat_%s" % stat_name
		stats_grid.add_child(lbl_k)
		stats_grid.add_child(lbl_v)
	inner.add_child(stats_grid)
	inner.add_child(_separator())
	var inv_header := HBoxContainer.new()
	inv_header.add_child(_section_label("  INVENTARIO  (45 slot)"))
	var sort_btn := _wood_button("⬆ Ordina")
	sort_btn.custom_minimum_size = Vector2(80, 22)
	sort_btn.pressed.connect(_sort_inventory)
	inv_header.add_child(sort_btn)
	inner.add_child(inv_header)
	var inv_grid := GridContainer.new()
	inv_grid.name = "InvGrid"
	inv_grid.columns = 6
	inv_grid.add_theme_constant_override("h_separation", 3)
	inv_grid.add_theme_constant_override("v_separation", 3)
	for i in G.INV_SIZE:
		var btn := _make_item_slot()
		btn.name = "inv_%d" % i
		btn.pressed.connect(_on_inv_slot_press.bind(i))
		inv_grid.add_child(btn)
	inner.add_child(inv_grid)


func _make_item_slot() -> Button:
	var b := Button.new()
	b.custom_minimum_size = Vector2(52, 52)
	var sf := StyleBoxFlat.new()
	sf.bg_color = Color(0.08, 0.05, 0.02)
	sf.border_color = Color(0.24, 0.14, 0.05)
	sf.set_border_width_all(1)
	sf.set_corner_radius_all(3)
	b.add_theme_stylebox_override("normal", sf)
	var sf_h := sf.duplicate(); sf_h.border_color = GOLD_COL
	b.add_theme_stylebox_override("hover", sf_h)
	b.add_theme_font_size_override("font_size", 22)
	return b


func _refresh_inventory() -> void:
	var pc := panels.get("inventory")
	if pc == null or not pc.visible:
		return
	var inner := pc.get_node_or_null("VBox/Scroll/Inner")
	if inner == null:
		return

	# Equipment slots
	var eq_grid := inner.get_node_or_null("EqGrid")
	if eq_grid:
		for slot in Data.EQUIP_SLOTS:
			var btn := eq_grid.get_node_or_null("eq_%s" % slot)
			if btn == null:
				continue
			if G.equipped.has(slot):
				var inst := G.equipped[slot]
				var def  := Data.ITEMS.get(inst["id"], {})
				btn.text = _item_emoji(def)
				var enh_str := "+%d " % inst["enh"] if inst["enh"] > 0 else ""
				btn.tooltip_text = "%s%s" % [enh_str, def.get("name", "?")]
			else:
				btn.text = _slot_emoji(slot)
				btn.tooltip_text = slot.capitalize()

	# Stats
	var sg := inner.get_node_or_null("StatsGrid")
	if sg:
		var pd := G.player_data
		var vals := {"ATK": pd.get("atk", 0), "MATK": pd.get("matk", 0),
			"DIF": pd.get("def", 0), "PV": "%d/%d" % [pd.get("hp", 0), pd.get("max_hp", 0)],
			"PM": "%d/%d" % [pd.get("mp", 0), pd.get("max_mp", 0)],
			"CRT": "%.0f%%" % pd.get("crit", 0), "VEL": "%.1f" % pd.get("speed", 0)}
		for k in vals.keys():
			var lbl := sg.get_node_or_null("stat_%s" % k)
			if lbl:
				lbl.text = str(vals[k])

	# Inventory grid
	var ig := inner.get_node_or_null("InvGrid")
	if ig:
		for i in G.INV_SIZE:
			var btn := ig.get_node_or_null("inv_%d" % i)
			if btn == null:
				continue
			var inst := G.inventory[i]
			if inst:
				var def := Data.ITEMS.get(inst["id"], {})
				btn.text = _item_emoji(def)
				btn.tooltip_text = _item_tooltip(inst, def)
			else:
				btn.text = ""
				btn.tooltip_text = ""


func _on_inv_slot_press(slot_idx: int) -> void:
	var inst := G.inventory[slot_idx]
	if inst == null:
		return
	var def := Data.ITEMS.get(inst["id"], {})
	# Show context menu
	_show_item_context(slot_idx, inst, def)


func _show_item_context(slot_idx: int, inst: Dictionary, def: Dictionary) -> void:
	# Remove any existing context popup
	var old := get_node_or_null("ItemContext")
	if old:
		old.queue_free()
	var popup := PanelContainer.new()
	popup.name = "ItemContext"
	var sf := StyleBoxFlat.new()
	sf.bg_color = Color(0.10, 0.06, 0.02, 0.96)
	sf.border_color = Color(0.38, 0.23, 0.07)
	sf.set_border_width_all(2)
	sf.set_corner_radius_all(4)
	popup.add_theme_stylebox_override("panel", sf)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 2)
	popup.add_child(vbox)
	# Title
	var title := _wood_label(def.get("name", "?"), 12, Color(0.85, 0.65, 0.25))
	vbox.add_child(title)
	vbox.add_child(_separator())
	# Actions
	if def.has("slot"):
		var eq_btn := _wood_button("⚔ Equipaggia")
		eq_btn.pressed.connect(func(): popup.queue_free(); G.equip_item(slot_idx))
		vbox.add_child(eq_btn)
	if def.get("kind") in ["potion", "food", "fish", "skill_book"]:
		var use_btn := _wood_button("✨ Usa")
		use_btn.pressed.connect(func(): popup.queue_free(); G.use_item_at(slot_idx))
		vbox.add_child(use_btn)
	var drop_btn := _wood_button("🗑 Getta")
	drop_btn.pressed.connect(func(): popup.queue_free(); _drop_item_from_inv(slot_idx))
	vbox.add_child(drop_btn)
	var cancel_btn := _wood_button("✕ Annulla")
	cancel_btn.pressed.connect(func(): popup.queue_free())
	vbox.add_child(cancel_btn)
	# Position near mouse
	var mpos := get_viewport().get_mouse_position()
	popup.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	popup.offset_left = clampf(mpos.x, 0, get_viewport_rect().size.x - 160)
	popup.offset_top  = clampf(mpos.y, 0, get_viewport_rect().size.y - 160)
	add_child(popup)


func _drop_item_from_inv(slot_idx: int) -> void:
	var inst := G.inventory[slot_idx]
	if inst == null:
		return
	var def := Data.ITEMS.get(inst["id"], {})
	G.remove_item_at(slot_idx, inst.get("qty", 1))
	G.notification.emit("Hai gettato: %s." % def.get("name", "?"), "info")


func _on_equip_slot_press(slot: String) -> void:
	if G.equipped.has(slot):
		G.unequip_item(slot)


func _item_emoji(def: Dictionary) -> String:
	var emojis := {"weapon": "⚔", "body": "🛡", "head": "🪖", "shield": "🛡",
		"boots": "👢", "bracelet": "📿", "necklace": "📿", "earring": "💎",
		"ring": "💍", "gem": "💠", "mount": "🐎", "hair": "💇",
		"potion": "🧪", "food": "🍖", "material": "📦", "scroll": "📜",
		"fish": "🐟", "fishing_rod": "🎣", "skill_book": "📖"}
	return emojis.get(def.get("slot", def.get("kind", "")), "❓")


func _item_tooltip(inst: Dictionary, def: Dictionary) -> String:
	var lines := []
	var enh := inst.get("enh", 0)
	var enh_str := "+%d " % enh if enh > 0 else ""
	var qty := inst.get("qty", 1)
	lines.append("%s%s%s" % [enh_str, def.get("name", "?"), " x%d" % qty if qty > 1 else ""])
	var q := def.get("quality", "common")
	lines.append(Data.QUALITY_NAMES.get(q, q))
	if def.get("lvl", 0) > 0:
		lines.append("Richiede Lv %d" % def["lvl"])
	var stats := []
	if def.get("atk",  0) > 0: stats.append("ATK +%d" % def["atk"])
	if def.get("matk", 0) > 0: stats.append("MATK +%d" % def["matk"])
	if def.get("def",  0) > 0: stats.append("DIF +%d" % def["def"])
	if def.get("hp",   0) > 0: stats.append("PV +%d" % def["hp"])
	if def.get("mp",   0) > 0: stats.append("PM +%d" % def["mp"])
	if def.get("crit", 0) > 0: stats.append("Crit +%d%%" % def["crit"])
	if def.get("speed",0) > 0: stats.append("Vel +%d" % def["speed"])
	if stats.size() > 0:
		lines.append("  ".join(stats))
	for b in inst.get("bonuses", []):
		lines.append("  [%s +%d]" % [b.get("label", "?"), b.get("val", 0)])
	var gem_slots: int = inst.get("gem_slots", 0)
	var gems: Array = inst.get("gems", [])
	if gem_slots > 0:
		var gem_str := ""
		for j in gem_slots:
			var gid: String = gems[j] if j < gems.size() else ""
			if gid != "":
				var gdef := Data.ITEMS.get(gid, {})
				gem_str += "💠%s " % gdef.get("name", "?")
			else:
				gem_str += "○ "
		lines.append("Slot gemme: %s" % gem_str.strip_edges())
	return "\n".join(lines)


func _sort_inventory() -> void:
	# Extract non-null items, sort by: slot/kind priority then quality then name
	var items := []
	for i in G.INV_SIZE:
		if G.inventory[i] != null:
			items.append(G.inventory[i])
	# Sort by kind priority → quality tier → name
	var kind_order := {"weapon": 0, "body": 1, "head": 2, "shield": 3, "boots": 4,
		"bracelet": 5, "necklace": 6, "earring": 7, "ring": 8,
		"mount": 9, "gem": 10, "scroll": 11, "food": 12, "potion": 13,
		"fish": 14, "fishing_rod": 15, "material": 16, "hair": 17}
	var quality_order := {"legendary": 0, "epic": 1, "rare": 2, "uncommon": 3, "common": 4}
	items.sort_custom(func(a, b):
		var da := Data.ITEMS.get(a["id"], {})
		var db := Data.ITEMS.get(b["id"], {})
		var ka := kind_order.get(da.get("slot", da.get("kind", "zzz")), 20)
		var kb := kind_order.get(db.get("slot", db.get("kind", "zzz")), 20)
		if ka != kb:
			return ka < kb
		var qa := quality_order.get(da.get("quality", "common"), 4)
		var qb := quality_order.get(db.get("quality", "common"), 4)
		if qa != qb:
			return qa < qb
		return da.get("name", "") < db.get("name", "")
	)
	for i in G.INV_SIZE:
		G.inventory[i] = items[i] if i < items.size() else null
	G.inventory_changed.emit()
	G.notification.emit("Inventario ordinato!", "info")


func _slot_emoji(slot: String) -> String:
	var emojis := {"weapon": "⚔", "body": "👕", "head": "🪖", "shield": "🛡",
		"boots": "👢", "bracelet": "📿", "necklace": "📿", "earring": "💎", "ring": "💍"}
	return emojis.get(slot, "○")


# ── Personaggio ───────────────────────────────────────────────

func _build_character_panel() -> void:
	var pc := _make_panel("Personaggio", 380, 480)
	panels["character"] = pc
	var scroll := pc.get_node("VBox/Scroll")
	var inner := VBoxContainer.new()
	inner.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(inner)
	# Will be populated in _refresh_character


func _refresh_character() -> void:
	var pc := panels.get("character")
	if pc == null or not pc.visible:
		return
	var scroll := pc.get_node_or_null("VBox/Scroll")
	if scroll == null:
		return
	for c in scroll.get_children():
		c.queue_free()
	var inner := VBoxContainer.new()
	inner.add_theme_constant_override("separation", 6)
	scroll.add_child(inner)
	var pd := G.player_data
	var cls_data := Data.CLASSES.get(pd.get("class", "guerriero"), {})
	# Portrait
	var p_lbl := _wood_label(["⚔", "🗡", "🔮", "🌿"][["guerriero","ninja","mago","sciamano"].find(pd.get("class","guerriero"))], 48, Color.WHITE)
	p_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	inner.add_child(p_lbl)
	inner.add_child(_wood_label(pd.get("name", "—"), 18, GOLD_COL))
	inner.add_child(_wood_label(cls_data.get("name", "—") + "  Lv " + str(pd.get("level", 1)), 13, TEXT_COL))
	inner.add_child(_wood_label("XP: %d / %d" % [pd.get("xp", 0), Data.level_xp(pd.get("level", 1))], 11, DIM_COL))
	inner.add_child(_wood_label("Punti Abilità: %d" % pd.get("skill_pts", 0), 11, GOLD_COL))
	# ── Stat allocation ──────────────────────────────────────────
	var stat_pts := pd.get("stat_pts", 0)
	var stat_col := GOLD_COL if stat_pts > 0 else DIM_COL
	inner.add_child(_separator())
	inner.add_child(_section_label("  ATTRIBUTI"))
	inner.add_child(_wood_label("Punti Attributo disponibili: %d" % stat_pts, 11, stat_col))
	var stat_defs := [
		["str", "Forza",       "ATK +2, DIF +1 per punto", Color(0.95, 0.45, 0.25)],
		["vit", "Vitalità",    "PV +25, DIF +1 per punto",  Color(0.35, 0.90, 0.40)],
		["int", "Intelligenza","MATK +2, PM +15 per punto", Color(0.45, 0.55, 0.95)],
	]
	for sd in stat_defs:
		var row := HBoxContainer.new()
		var cur_val := pd.get("stat_%s" % sd[0], 0)
		var lbl_txt := "%s: %d" % [sd[1], cur_val]
		var stat_lbl := _wood_label(lbl_txt, 12, sd[3])
		stat_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		stat_lbl.tooltip_text = sd[2]
		row.add_child(stat_lbl)
		var add_btn := _wood_button("+")
		add_btn.custom_minimum_size = Vector2(28, 24)
		add_btn.disabled = stat_pts <= 0
		add_btn.pressed.connect(func():
			G.add_stat_point(sd[0])
			_refresh_character())
		row.add_child(add_btn)
		inner.add_child(row)
	inner.add_child(_separator())
	inner.add_child(_section_label("  ABILITÀ"))
	for sk_id in cls_data.get("skills", []):
		var sk := Data.SKILLS.get(sk_id, {})
		var sk_lvl := pd.get("skill_lvls", {}).get(sk_id, 1)
		var row := HBoxContainer.new()
		var name_lbl := _wood_label("  %s  Lv%d" % [sk.get("name", sk_id), sk_lvl], 12, TEXT_COL)
		name_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(name_lbl)
		var up_btn := _wood_button("+")
		up_btn.custom_minimum_size = Vector2(28, 24)
		up_btn.pressed.connect(_upgrade_skill.bind(sk_id))
		up_btn.disabled = pd.get("skill_pts", 0) <= 0 or sk_lvl >= 10
		row.add_child(up_btn)
		inner.add_child(row)
		inner.add_child(_wood_label("    CD %.1fs  MP %d  Moltiplicatore ×%.1f" % [sk.get("cd", 0), sk.get("mp", 0), sk.get("mult", 1.0) * (1 + (sk_lvl - 1) * 0.08)], 10, DIM_COL))


func _upgrade_skill(sk_id: String) -> void:
	var pd := G.player_data
	if pd.get("skill_pts", 0) <= 0:
		G.notification.emit("Nessun punto abilità disponibile.", "error")
		return
	var lvl := pd.get("skill_lvls", {}).get(sk_id, 1)
	if lvl >= 10:
		G.notification.emit("Abilità già al livello massimo.", "error")
		return
	pd["skill_pts"] -= 1
	if not pd.has("skill_lvls"):
		pd["skill_lvls"] = {}
	pd["skill_lvls"][sk_id] = lvl + 1
	G.notification.emit("Abilità migliorata: Lv %d!" % (lvl + 1), "success")
	G.player_stats_changed.emit()
	_refresh_character()


# ── Missioni ──────────────────────────────────────────────────

func _build_quest_panel() -> void:
	var pc := _make_panel("Missioni", 420, 520)
	panels["quests"] = pc


func _refresh_quests() -> void:
	var pc := panels.get("quests")
	if pc == null or not pc.visible:
		return
	var scroll := pc.get_node_or_null("VBox/Scroll")
	if scroll == null:
		return
	for c in scroll.get_children():
		c.queue_free()
	var inner := VBoxContainer.new()
	scroll.add_child(inner)
	inner.add_child(_section_label("  MISSIONI ATTIVE"))
	if G.active_quests.is_empty():
		inner.add_child(_wood_label("  Nessuna missione attiva.", 12, DIM_COL))
	for qid in G.active_quests.keys():
		var q := Data.QUESTS.get(qid, {})
		var qa := G.active_quests[qid]
		var complete := G.is_quest_complete(qid)
		var row := PanelContainer.new()
		var rsf := StyleBoxFlat.new()
		rsf.bg_color = Color(0.05, 0.12, 0.04) if complete else Color(0.08, 0.05, 0.02)
		rsf.border_color = Color(0.2, 0.6, 0.2) if complete else BORDER_COL
		rsf.set_border_width_all(1); rsf.set_corner_radius_all(3)
		row.add_theme_stylebox_override("panel", rsf)
		var rv := VBoxContainer.new()
		rv.add_child(_wood_label(q.get("name", qid), 13, GOLD_COL if complete else TEXT_COL))
		rv.add_child(_wood_label(q.get("desc", ""), 10, DIM_COL))
		# Progress
		for goal_type in q.get("goals", {}).keys():
			for key in q["goals"][goal_type].keys():
				var cur := qa["progress"].get(key, 0)
				var max_v := q["goals"][goal_type][key]
				var txt: String
				if goal_type == "kill":
					txt = "  Uccidi %s: %d/%d" % [Data.MONSTERS.get(key, {}).get("name", key), cur, max_v]
				elif goal_type == "collect":
					txt = "  Raccogli %s: %d/%d" % [Data.ITEMS.get(key, {}).get("name", key), cur, max_v]
				else:
					txt = "  %s: %d/%d" % [key, cur, max_v]
				var col := Color(0.5, 1.0, 0.5) if cur >= max_v else TEXT_COL
				rv.add_child(_wood_label(txt, 11, col))
		if complete:
			var btn := _wood_button("Consegna")
			btn.pressed.connect(func(): G.turn_in_quest(qid); _refresh_quests())
			rv.add_child(btn)
		row.add_child(rv)
		inner.add_child(row)
	inner.add_child(_separator())
	inner.add_child(_section_label("  COMPLETATE: %d" % G.done_quests.size()))


# ── Mappa ─────────────────────────────────────────────────────

func _build_map_panel() -> void:
	var pc := _make_panel("Mappa del Mondo", 520, 480)
	panels["map"] = pc
	var scroll := pc.get_node("VBox/Scroll")
	# Mappa 2D procedurale
	var map_ctrl := Control.new()
	map_ctrl.custom_minimum_size = Vector2(500, 430)
	map_ctrl.draw.connect(func(): _draw_world_map(map_ctrl))
	scroll.add_child(map_ctrl)


func _draw_world_map(ctrl: Control) -> void:
	var size := ctrl.size
	var scale_f := size.x / 3200.0
	# Background
	ctrl.draw_rect(Rect2(Vector2.ZERO, size), Color(0.08, 0.06, 0.04))
	# Zones
	for zone in Data.ZONES:
		var c : Vector2 = zone["center"]
		var r : float = zone["radius"]
		var cx := (c.x + 1600) * scale_f
		var cy := (c.y + 1600) * scale_f
		ctrl.draw_circle(Vector2(cx, cy), r * scale_f, zone["color"].darkened(0.3))
		# Zone name
		ctrl.draw_string(ThemeDB.fallback_font, Vector2(cx - 30, cy),
			zone["name"], HORIZONTAL_ALIGNMENT_LEFT, -1, 10, GOLD_COL)
	# Village
	var vc := Vector2(1600 * scale_f, 1600 * scale_f)
	ctrl.draw_circle(vc, 18 * scale_f, Color(0.8, 0.7, 0.4, 0.6))
	ctrl.draw_string(ThemeDB.fallback_font, vc + Vector2(-20, -4), "Pietrascura", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color.WHITE)
	# NPC markers (teal circles)
	for npc_id in Data.NPCS.keys():
		var ndata := Data.NPCS[npc_id]
		var nc : Vector2 = ndata["pos"]
		var nx := (nc.x + 1600) * scale_f
		var ny := (nc.y + 1600) * scale_f
		ctrl.draw_circle(Vector2(nx, ny), 4.0, Color(0.3, 0.9, 0.6))
	# Dungeon portals (purple markers)
	var portals_pos := [Vector2(400,-800), Vector2(-600,400), Vector2(900,200),
		Vector2(-300,-900), Vector2(700,700), Vector2(-900,600)]
	var portal_names := ["Grotta Banditi","Bosco Maledetto","Rovine Metin",
		"Cripta Orchi","Torre Oscurità","Vulcano"]
	for i in portals_pos.size():
		var pp2 := portals_pos[i]
		var ppx := (pp2.x + 1600) * scale_f
		var ppz := (pp2.y + 1600) * scale_f
		ctrl.draw_circle(Vector2(ppx, ppz), 6.0, Color(0.6, 0.3, 0.9, 0.85))
		ctrl.draw_string(ThemeDB.fallback_font, Vector2(ppx + 5, ppz),
			portal_names[i], HORIZONTAL_ALIGNMENT_LEFT, -1, 8, Color(0.8, 0.6, 1.0))
	# Player marker
	var pl_arr := get_tree().get_nodes_in_group("player")
	if pl_arr.size() > 0:
		var p: Node3D = pl_arr[0]
		var px := (p.global_position.x + 1600) * scale_f
		var pz := (p.global_position.z + 1600) * scale_f
		ctrl.draw_circle(Vector2(px, pz), 6.0, Color(0.2, 0.7, 1.0))
		# Direction indicator
		var fwd_x := px + sin(p.rotation.y) * 8.0
		var fwd_z := pz + cos(p.rotation.y) * 8.0
		ctrl.draw_line(Vector2(px, pz), Vector2(fwd_x, fwd_z), Color(0.2, 0.7, 1.0), 1.5)


# ── Forgia ────────────────────────────────────────────────────

func _build_forge_panel() -> void:
	var pc := _make_panel("Forgia", 420, 500)
	panels["forge"] = pc


func _refresh_forge() -> void:
	var pc := panels.get("forge")
	if pc == null or not pc.visible:
		return
	var scroll := pc.get_node_or_null("VBox/Scroll")
	if scroll == null: return
	for c in scroll.get_children(): c.queue_free()
	var inner := VBoxContainer.new()
	scroll.add_child(inner)

	# ── Enhancement section ──────────────────────────────────────
	inner.add_child(_section_label("  ▸ POTENZIAMENTO"))
	inner.add_child(_wood_label("Potenzia equipaggiamento fino a +9.", 11, DIM_COL))
	inner.add_child(_separator())
	for i in G.INV_SIZE:
		var inst := G.inventory[i]
		if inst == null: continue
		var def := Data.ITEMS.get(inst["id"], {})
		if not def.has("slot"): continue
		var enh := inst.get("enh", 0)
		if enh >= 9: continue
		var row := HBoxContainer.new()
		var name_lbl := _wood_label("+%d  %s" % [enh, def.get("name","?")], 12, TEXT_COL)
		name_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(name_lbl)
		var rate := Data.ENHANCE_RATES[enh]
		var cost := (enh + 1) * 500
		var need_stone := enh >= 3
		var cost_str := "💰%d%s" % [cost, "  +Pietra" if need_stone else ""]
		var enh_btn := _wood_button("%d%%  %s" % [rate, cost_str])
		enh_btn.pressed.connect(_do_enhance.bind(i))
		row.add_child(enh_btn)
		inner.add_child(row)

	# ── Enchantment section (scroll reroll) ─────────────────────────
	inner.add_child(_separator())
	inner.add_child(_section_label("  ▸ INCANTAMENTO BONUS"))
	inner.add_child(_wood_label("Usa Pergamena dell'Incantamento per rilanciare i bonus.", 11, DIM_COL))
	var has_ench_scroll := G.find_item("pergamena_incantamento") >= 0
	inner.add_child(_separator())
	for eq_slot in G.equipped.keys():
		var inst := G.equipped[eq_slot]
		var def := Data.ITEMS.get(inst["id"], {})
		if not def.has("slot"):
			continue
		var q := def.get("quality", "common")
		if q == "common":
			continue
		var row := HBoxContainer.new()
		var bonus_cnt := inst.get("bonuses", []).size()
		var lbl := _wood_label("[%d bonus]  %s" % [bonus_cnt, def.get("name","?")], 12, TEXT_COL)
		lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(lbl)
		var ench_btn := _wood_button("✨ Rilancia")
		ench_btn.disabled = not has_ench_scroll
		ench_btn.pressed.connect(_do_enchant.bind(eq_slot))
		row.add_child(ench_btn)
		inner.add_child(row)

	# ── Gem socketing section ─────────────────────────────────────
	inner.add_child(_separator())
	inner.add_child(_section_label("  ▸ INCASTONATURA GEMME"))
	inner.add_child(_wood_label("Incastona gemme negli slot liberi degli oggetti.", 11, DIM_COL))
	inner.add_child(_separator())

	# List equipment with open gem slots
	for eq_slot in G.equipped.keys():
		var inst := G.equipped[eq_slot]
		var def := Data.ITEMS.get(inst["id"], {})
		var gem_slots: int = inst.get("gem_slots", 0)
		if gem_slots == 0: continue
		var gems: Array = inst.get("gems", [])
		var free_slots := 0
		for j in gem_slots:
			if j >= gems.size() or gems[j] == "":
				free_slots += 1
		if free_slots == 0: continue
		var row := HBoxContainer.new()
		var lbl := _wood_label("[%d slot]  %s" % [free_slots, def.get("name","?")], 12, TEXT_COL)
		lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(lbl)
		# Show available gems from inventory
		for gi in G.INV_SIZE:
			var gem_inst := G.inventory[gi]
			if gem_inst == null: continue
			var gdef := Data.ITEMS.get(gem_inst["id"], {})
			if gdef.get("kind") != "gem": continue
			var socket_btn := _wood_button("💠%s" % gdef.get("name","?"))
			socket_btn.pressed.connect(_do_socket.bind(eq_slot, gi))
			row.add_child(socket_btn)
			break  # One gem option at a time for simplicity
		inner.add_child(row)


func _do_enhance(inv_slot: int) -> void:
	var inst := G.inventory[inv_slot]
	if inst == null: return
	var enh := inst.get("enh", 0)
	if enh >= 9:
		G.notification.emit("Oggetto già al massimo potenziamento (+9).", "error")
		return
	var cost := (enh + 1) * 500
	if not G.spend_gold(cost): return
	if enh >= 3:
		var si := G.find_item("pietra_raffinazione")
		if si < 0:
			G.notification.emit("Serve una Pietra di Raffinazione!", "error")
			G.gain_gold(cost)  # refund
			return
		G.remove_item_at(si, 1)
	# Check blessing scroll
	var has_blessing := G.find_item("pergamena_benedizione") >= 0
	var rate := Data.ENHANCE_RATES[enh] / 100.0
	if randf() < rate:
		inst["enh"] += 1
		G.notification.emit("Potenziamento riuscito! +%d" % inst["enh"], "success")
	else:
		if has_blessing:
			G.notification.emit("Fallito ma protetto dalla pergamena!", "info")
		else:
			if enh >= 5:
				inst["enh"] = maxi(0, enh - 1)
			G.notification.emit("Potenziamento fallito!", "error")
	G.recalc_stats()
	G.inventory_changed.emit()
	_refresh_forge()


func _do_enchant(eq_slot: String) -> void:
	var si := G.find_item("pergamena_incantamento")
	if si < 0:
		G.notification.emit("Serve una Pergamena dell'Incantamento!", "error")
		return
	var eq_inst := G.equipped.get(eq_slot)
	if eq_inst == null:
		return
	G.remove_item_at(si, 1)
	var def := Data.ITEMS.get(eq_inst["id"], {})
	eq_inst["bonuses"] = G._roll_bonuses(def)
	G.recalc_stats()
	G.notification.emit("Bonus riestratti con successo!", "success")
	G.inventory_changed.emit()
	_refresh_forge()


func _do_socket(eq_slot: String, gem_inv_slot: int) -> void:
	var eq_inst := G.equipped.get(eq_slot)
	if eq_inst == null:
		G.notification.emit("Oggetto non equipaggiato.", "error")
		return
	var gem_inst := G.inventory[gem_inv_slot]
	if gem_inst == null:
		G.notification.emit("Gemma non trovata.", "error")
		return
	var gem_slots: int = eq_inst.get("gem_slots", 0)
	if gem_slots == 0:
		G.notification.emit("Questo oggetto non ha slot per gemme.", "error")
		return
	if not eq_inst.has("gems"):
		eq_inst["gems"] = []
	# Find first empty slot
	var placed := false
	for j in gem_slots:
		if j >= eq_inst["gems"].size():
			eq_inst["gems"].append(gem_inst["id"])
			placed = true
			break
		elif eq_inst["gems"][j] == "":
			eq_inst["gems"][j] = gem_inst["id"]
			placed = true
			break
	if not placed:
		G.notification.emit("Nessuno slot libero disponibile.", "error")
		return
	G.remove_item_at(gem_inv_slot, 1)
	G.recalc_stats()
	var gdef := Data.ITEMS.get(gem_inst["id"], {})
	G.notification.emit("%s incastonata!" % gdef.get("name", "?"), "success")
	G.inventory_changed.emit()
	_refresh_forge()


# ── Alchimia ──────────────────────────────────────────────────

func _build_alchemy_panel() -> void:
	var pc := _make_panel("Alchimia", 400, 480)
	panels["alchemy"] = pc


func _refresh_alchemy() -> void:
	var pc := panels.get("alchemy")
	if pc == null or not pc.visible: return
	var scroll := pc.get_node_or_null("VBox/Scroll")
	if scroll == null: return
	for c in scroll.get_children(): c.queue_free()
	var inner := VBoxContainer.new()
	scroll.add_child(inner)
	inner.add_child(_wood_label("Combina 3 gemme dello stesso tipo e grado per ottenere il grado superiore.", 11, DIM_COL))
	inner.add_child(_separator())
	# Group gems by type+grade
	var gem_counts := {}
	for i in G.INV_SIZE:
		var inst := G.inventory[i]
		if inst == null: continue
		var def := Data.ITEMS.get(inst["id"], {})
		if def.get("kind") != "gem": continue
		gem_counts[inst["id"]] = gem_counts.get(inst["id"], 0) + inst.get("qty", 1)
	for gem_id in gem_counts.keys():
		var def := Data.ITEMS.get(gem_id, {})
		var count := gem_counts[gem_id]
		var grade := def.get("grade", 1)
		var row := HBoxContainer.new()
		var lbl := _wood_label("💠 %s  (x%d)" % [def.get("name","?"), count], 12, TEXT_COL)
		lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(lbl)
		if count >= 3 and grade < 5:
			var btn := _wood_button("Combina →")
			btn.pressed.connect(_do_alchemy.bind(gem_id))
			row.add_child(btn)
		inner.add_child(row)


func _do_alchemy(gem_id: String) -> void:
	var def := Data.ITEMS.get(gem_id, {})
	if def.get("grade", 1) >= 5:
		G.notification.emit("Questa gemma è già al grado massimo.", "error")
		return
	# Remove 3
	var removed := 0
	for i in G.INV_SIZE:
		if removed >= 3: break
		var inst := G.inventory[i]
		if inst and inst["id"] == gem_id:
			var take := mini(3 - removed, inst["qty"])
			G.remove_item_at(i, take)
			removed += take
	if removed < 3:
		G.notification.emit("Non hai abbastanza gemme (servono 3).", "error")
		return
	# Create grade+1 gem
	var next_gem := "%s_g%d" % [gem_id.substr(0, gem_id.rfind("_")), def["grade"] + 1]
	G.add_item(next_gem)
	G.notification.emit("Gemma avanzata: %s!" % Data.ITEMS[next_gem]["name"], "success")
	_refresh_alchemy()


# ── Dialogo NPC ───────────────────────────────────────────────

func _build_dialogue() -> void:
	var pc := PanelContainer.new()
	pc.name = "Dialogue"
	pc.custom_minimum_size = Vector2(560, 1)
	pc.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	pc.offset_bottom = -80; pc.offset_top = -220
	var sf := StyleBoxFlat.new()
	sf.bg_color = WOOD_DARK
	sf.border_color = BORDER_COL
	sf.set_border_width_all(2)
	sf.set_corner_radius_all(6)
	pc.add_theme_stylebox_override("panel", sf)
	pc.visible = false
	panels["dialogue"] = pc
	var vbox := VBoxContainer.new()
	vbox.name = "VBox"
	vbox.add_theme_constant_override("separation", 8)
	pc.add_child(vbox)
	var hrow := HBoxContainer.new()
	hrow.name = "HRow"
	var portrait_lbl := Label.new()
	portrait_lbl.name = "Portrait"
	portrait_lbl.add_theme_font_size_override("font_size", 44)
	portrait_lbl.custom_minimum_size = Vector2(56, 56)
	portrait_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hrow.add_child(portrait_lbl)
	var content := VBoxContainer.new()
	content.name = "Content"
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var npc_name_lbl := Label.new()
	npc_name_lbl.name = "NPCName"
	npc_name_lbl.add_theme_color_override("font_color", GOLD_COL)
	npc_name_lbl.add_theme_font_size_override("font_size", 14)
	content.add_child(npc_name_lbl)
	var text_lbl := Label.new()
	text_lbl.name = "Text"
	text_lbl.add_theme_color_override("font_color", TEXT_COL)
	text_lbl.add_theme_font_size_override("font_size", 12)
	text_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	content.add_child(text_lbl)
	hrow.add_child(content)
	vbox.add_child(hrow)
	var opts_box := VBoxContainer.new()
	opts_box.name = "Options"
	vbox.add_child(opts_box)
	add_child(pc)


func _show_dialogue(npc_id: String) -> void:
	dialogue_npc = npc_id
	var ndata := Data.NPCS.get(npc_id, {})
	if ndata.is_empty():
		return
	var pc := panels["dialogue"]
	pc.get_node("VBox/HRow/Portrait").text = ["⚗", "⚔", "💊", "🍺", "💇", "🧪", "🐎", "✨", "🎯", "🛡", "🍲", "📚", "🗺"][Data.NPCS.keys().find(npc_id) % 13]
	pc.get_node("VBox/HRow/Content/NPCName").text = ndata["name"]
	pc.get_node("VBox/HRow/Content/Text").text = ndata["greeting"]
	_build_dialogue_options(ndata)
	pc.visible = true


func _build_dialogue_options(ndata: Dictionary) -> void:
	var opts := panels["dialogue"].get_node("VBox/Options")
	for c in opts.get_children():
		c.queue_free()
	var services := ndata.get("services", {})
	if services.has("shop"):
		var btn := _wood_button("▶ Negozio")
		btn.pressed.connect(func(): _show_shop(ndata["id"]); _close_dialogue())
		opts.add_child(btn)
	if services.has("forge"):
		var btn := _wood_button("▶ Forgia")
		btn.pressed.connect(func(): _show_panel("forge"); _close_dialogue())
		opts.add_child(btn)
	if services.has("alchemy"):
		var btn := _wood_button("▶ Alchimia")
		btn.pressed.connect(func(): _show_panel("alchemy"); _close_dialogue())
		opts.add_child(btn)
	if services.has("rest"):
		var btn := _wood_button("▶ Riposa (gratis)")
		btn.pressed.connect(func():
			G.player_data["hp"] = G.player_data["max_hp"]
			G.player_data["mp"] = G.player_data["max_mp"]
			G.player_stats_changed.emit()
			G.notification.emit("Riposato e curato completamente!", "success")
			_close_dialogue())
		opts.add_child(btn)
	if services.has("barber"):
		var btn := _wood_button("▶ Cambia acconciatura")
		btn.pressed.connect(func(): _show_shop(ndata["id"]); _close_dialogue())
		opts.add_child(btn)
	if services.has("skills"):
		var btn := _wood_button("▶ Addestramento Abilità")
		btn.pressed.connect(func(): _show_panel("character"); _close_dialogue())
		opts.add_child(btn)
	if services.has("heal"):
		var btn := _wood_button("▶ Cura (100 💰)")
		btn.pressed.connect(func():
			if G.spend_gold(100):
				G.player_data["hp"] = G.player_data["max_hp"]
				G.player_data["mp"] = G.player_data["max_mp"]
				G.player_stats_changed.emit()
				G.notification.emit("Curato completamente!", "success")
				_close_dialogue())
		opts.add_child(btn)
	if services.has("quests"):
		for qid in services["quests"]:
			if G.done_quests.has(qid):
				continue
			var q := Data.QUESTS.get(qid, {})
			if G.active_quests.has(qid):
				if G.is_quest_complete(qid):
					var btn := _wood_button("▶ Consegna: %s" % q.get("name", qid))
					btn.pressed.connect(func(): G.turn_in_quest(qid); _close_dialogue())
					opts.add_child(btn)
			else:
				if G.player_data["level"] >= q.get("lvl", 1):
					var btn := _wood_button("▶ Missione: %s (Lv%d)" % [q.get("name", qid), q.get("lvl", 1)])
					btn.pressed.connect(func(): G.accept_quest(qid); _build_dialogue_options(ndata))
					opts.add_child(btn)
	var close_btn := _wood_button("▶ Arrivederci")
	close_btn.pressed.connect(_close_dialogue)
	opts.add_child(close_btn)


func _close_dialogue() -> void:
	if panels.has("dialogue"):
		panels["dialogue"].visible = false
	dialogue_npc = ""


# ── Negozio ───────────────────────────────────────────────────

func _build_shop_panel() -> void:
	var pc := _make_panel("Negozio", 640, 560)
	panels["shop"] = pc


func _show_shop(npc_id: String) -> void:
	shop_npc_id = npc_id
	var ndata := Data.NPCS.get(npc_id, {})
	var shop_id: String = ndata.get("services", {}).get("shop", "")
	if shop_id == "":
		return
	var shop := Data.SHOPS.get(shop_id, {})
	var pc := panels["shop"]
	var scroll := pc.get_node_or_null("VBox/Scroll")
	if scroll == null: return
	for c in scroll.get_children(): c.queue_free()
	var inner := HBoxContainer.new()
	scroll.add_child(inner)
	# Buy column
	var buy_col := VBoxContainer.new()
	buy_col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	buy_col.add_child(_section_label("  COMPRA"))
	for item_id in shop.get("items", []):
		if not Data.ITEMS.has(item_id): continue
		var def := Data.ITEMS[item_id]
		var row := HBoxContainer.new()
		var icon_lbl := Label.new()
		icon_lbl.text = _item_emoji(def)
		icon_lbl.add_theme_font_size_override("font_size", 20)
		row.add_child(icon_lbl)
		var info := VBoxContainer.new()
		info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		info.add_child(_wood_label(def.get("name", "?"), 12, TEXT_COL))
		if def.has("lvl"):
			info.add_child(_wood_label("Richiede Lv %d" % def["lvl"], 10, DIM_COL))
		row.add_child(info)
		var price_btn := _wood_button("💰 %d" % def.get("price", 0))
		price_btn.pressed.connect(_buy_item.bind(item_id))
		# Equipment stat comparison tooltip
		var slot := def.get("slot", "")
		if slot != "" and G.equipped.has(slot):
			var cur_def := Data.ITEMS.get(G.equipped[slot]["id"], {})
			var cmp := ""
			for sk in ["atk", "matk", "def", "hp", "mp", "crit", "speed"]:
				var nv := def.get(sk, 0); var cv := cur_def.get(sk, 0)
				if nv != cv:
					var d := nv - cv
					cmp += "  %s: %s%d\n" % [sk.to_upper(), ("+" if d > 0 else ""), d]
			if cmp != "":
				price_btn.tooltip_text = "Vs equipaggiato:\n%s" % cmp.strip_edges()
		row.add_child(price_btn)
		buy_col.add_child(row)
	inner.add_child(buy_col)
	# Sell column
	var sell_col := VBoxContainer.new()
	sell_col.custom_minimum_size = Vector2(180, 0)
	sell_col.add_child(_section_label("  VENDI"))
	for i in G.INV_SIZE:
		var inst := G.inventory[i]
		if inst == null: continue
		var def := Data.ITEMS.get(inst["id"], {})
		var sell_price := int(def.get("price", 10) * 0.4)
		var row := HBoxContainer.new()
		var lbl := _wood_label(_item_emoji(def) + " " + def.get("name","?"), 11, TEXT_COL)
		lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(lbl)
		var sell_btn := _wood_button("💰%d" % sell_price)
		sell_btn.pressed.connect(_sell_item.bind(i, sell_price))
		row.add_child(sell_btn)
		sell_col.add_child(row)
	inner.add_child(sell_col)
	var tl := pc.get_node_or_null("VBox/Header/TitleRow/Title")
	if tl:
		tl.text = shop.get("name", "Negozio").to_upper()
	_show_panel("shop")


func _buy_item(item_id: String) -> void:
	var def := Data.ITEMS.get(item_id, {})
	var price := def.get("price", 0)
	if not G.spend_gold(price): return
	if not G.add_item(item_id):
		G.gain_gold(price)  # refund


func _sell_item(inv_slot: int, price: int) -> void:
	if G.inventory[inv_slot] == null: return
	G.gain_gold(price)
	G.remove_item_at(inv_slot, 1)
	G.notification.emit("Venduto per %d 💰!" % price, "success")
	_show_shop(shop_npc_id)


# ── ESC Menu ──────────────────────────────────────────────────

func _build_esc_menu() -> void:
	var pc := PanelContainer.new()
	pc.name = "EscMenu"
	pc.set_anchors_preset(Control.PRESET_CENTER)
	pc.custom_minimum_size = Vector2(260, 1)
	var sf := StyleBoxFlat.new()
	sf.bg_color = WOOD_DARK
	sf.border_color = BORDER_COL
	sf.set_border_width_all(2)
	sf.set_corner_radius_all(6)
	pc.add_theme_stylebox_override("panel", sf)
	pc.visible = false
	panels["esc"] = pc
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 8)
	vbox.alignment = BoxContainer.ALIGNMENT_CENTER
	pc.add_child(vbox)
	vbox.add_child(_wood_label("PAUSA", 20, GOLD_COL))
	vbox.add_child(_separator())
	var resume := _wood_button("Riprendi")
	resume.pressed.connect(func(): show_esc_menu(false))
	vbox.add_child(resume)
	var save_btn := _wood_button("Salva")
	save_btn.pressed.connect(func(): get_parent()._save_game(); G.notification.emit("Partita salvata!", "success"))
	vbox.add_child(save_btn)
	var inv_btn := _wood_button("Inventario")
	inv_btn.pressed.connect(func(): show_esc_menu(false); _toggle_panel("inventory"))
	vbox.add_child(inv_btn)
	var quit_btn := _wood_button("Esci al desktop")
	quit_btn.pressed.connect(func(): get_tree().quit())
	vbox.add_child(quit_btn)
	add_child(pc)


func show_esc_menu(visible: bool) -> void:
	if panels.has("esc"):
		panels["esc"].visible = visible


# ── Panel management ──────────────────────────────────────────

func _toggle_panel(name: String) -> void:
	if not panels.has(name):
		return
	var pc := panels[name]
	if pc.visible:
		_close_panel()
	else:
		_show_panel(name)


func _show_panel(name: String) -> void:
	_close_panel()
	current_panel = name
	panels[name].visible = true
	_refresh_open_panel()


func _close_panel() -> void:
	if current_panel != "" and panels.has(current_panel):
		panels[current_panel].visible = false
	current_panel = ""


func _refresh_open_panel(_qid: String = "") -> void:
	match current_panel:
		"inventory":    _refresh_inventory()
		"character":    _refresh_character()
		"quests":       _refresh_quests()
		"forge":        _refresh_forge()
		"alchemy":      _refresh_alchemy()
		"achievements": _refresh_achievements()


func _build_achievements_panel() -> void:
	var pc := _make_panel("Obiettivi  [H]", 460, 520)
	panels["achievements"] = pc


func _refresh_achievements() -> void:
	var pc := panels.get("achievements")
	if pc == null or not pc.visible:
		return
	var scroll := pc.get_node_or_null("VBox/Scroll")
	if scroll == null:
		return
	for c in scroll.get_children():
		c.queue_free()
	var inner := VBoxContainer.new()
	inner.add_theme_constant_override("separation", 5)
	scroll.add_child(inner)

	var total  := G.ACHIEVEMENT_DEFS.size()
	var done   := G.achievements.size()
	inner.add_child(_wood_label("Completati: %d / %d" % [done, total], 13, GOLD_COL))
	inner.add_child(_separator())

	for def in G.ACHIEVEMENT_DEFS:
		var ach_id : String = def[0]
		var completed : bool = G.achievements.has(ach_id)
		var row := PanelContainer.new()
		var rsf := StyleBoxFlat.new()
		rsf.bg_color = Color(0.04, 0.10, 0.03) if completed else Color(0.08, 0.05, 0.02)
		rsf.border_color = Color(0.2, 0.65, 0.2) if completed else BORDER_COL
		rsf.set_border_width_all(1)
		rsf.set_corner_radius_all(3)
		row.add_theme_stylebox_override("panel", rsf)

		var hb := HBoxContainer.new()
		var icon_lbl := _wood_label("🏆" if completed else "○", 18, Color(1.0, 0.85, 0.2) if completed else DIM_COL)
		icon_lbl.custom_minimum_size = Vector2(28, 0)
		hb.add_child(icon_lbl)
		var vb := VBoxContainer.new()
		vb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var name_color := GOLD_COL if completed else TEXT_COL
		vb.add_child(_wood_label(def[1], 13, name_color))
		vb.add_child(_wood_label(def[2], 10, DIM_COL))
		hb.add_child(vb)
		var rwd_txt := "+%d XP  +%d 💰" % [def[5], def[6]]
		if def[7] > 0:
			rwd_txt += "  +%d PA" % def[7]
		vb.add_child(_wood_label(rwd_txt, 9, Color(0.55, 0.85, 0.55) if completed else DIM_COL))
		row.add_child(hb)
		inner.add_child(row)


func _on_npc_interact(npc_id: String) -> void:
	_show_dialogue(npc_id)


func _on_quest_update(_qid: String) -> void:
	if current_panel == "quests":
		_refresh_quests()
