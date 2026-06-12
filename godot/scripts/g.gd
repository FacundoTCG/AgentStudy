extends Node
## G — Singleton di stato globale. Contiene il giocatore, inventario,
## missioni, sistema di combattimento, eventi di gioco.

signal player_stats_changed
signal inventory_changed
signal quest_updated(quest_id: String)
signal npc_interaction(npc_id: String)
signal combat_message(text: String, kind: String)
signal level_up(new_level: int)
signal mob_killed(mob_id: String, mob_name: String, xp: int, gold: int)
signal item_dropped(item_id: String, pos: Vector3)
signal notification(text: String, kind: String)

# ─── Player data ──────────────────────────────────────────────
var player_data := {}          # stats, level, class, etc.
var equipped    := {}          # slot → ItemInstance
var inventory   := []          # array of ItemInstance (45 slot)
var buffs       := []          # array of {stat, val, dur, remains}

# ─── Quest / kill tracking ────────────────────────────────────
var active_quests  := {}       # quest_id → {progress: {}, state: "active"}
var done_quests    := []
var kill_counts    := {}       # mob_id → int

# ─── World state ──────────────────────────────────────────────
var current_zone   : Dictionary = {}
var mount_active   := false
var hair_item      := ""

# Set by startup screen before loading main scene
var pending_class := "guerriero"
var pending_name  := "Avventuriero"

const INV_SIZE := 45


func _ready() -> void:
	pass


# ─── Player creation ──────────────────────────────────────────

func init_player(class_key: String, player_name: String) -> void:
	var cls: Dictionary = Data.CLASSES[class_key]
	var s: Dictionary = cls["base"]
	player_data = {
		"name"     : player_name,
		"class"    : class_key,
		"level"    : 1,
		"xp"       : 0,
		"hp"       : s["hp"], "max_hp"  : s["hp"],
		"mp"       : s["mp"], "max_mp"  : s["mp"],
		"base_atk" : s["atk"], "atk"    : s["atk"],
		"base_matk": s["matk"],"matk"   : s["matk"],
		"base_def" : s["def"], "def"    : s["def"],
		"base_spd" : s["speed"],"speed" : s["speed"],
		"crit"     : s["crit"],
		"gold"     : 100,
		"potions"  : 5,
		"kills"    : 0,
		"deaths"   : 0,
		"skill_pts": 0,
		"skill_lvls": {},
	}
	equipped = {}
	inventory = []
	for i in INV_SIZE:
		inventory.append(null)
	# Starter gear
	_add_item("pozione_rossa_s", 5)
	_add_item("pozione_blu_s", 3)
	_add_item("cibo_01", 2)
	var starter_wpn := "wpn_%s_01" % class_key
	if Data.ITEMS.has(starter_wpn):
		_add_item(starter_wpn)


# ─── Item Instance factory ────────────────────────────────────

static func make_instance(item_id: String, qty: int = 1) -> Dictionary:
	var def: Dictionary = Data.ITEMS[item_id]
	var inst := {"id": item_id, "qty": qty, "enh": 0, "bonuses": [], "gems": []}
	if def.has("slot"):
		# Roll 0-3 random bonuses
		var slots: int = Data.SOCKETS_BY_QUALITY.get(def.get("quality", "common"), 0)
		inst["bonuses"] = _roll_bonuses(def)
		inst["gem_slots"] = slots
	return inst


static func _roll_bonuses(def: Dictionary) -> Array:
	var q := def.get("quality", "common")
	var count := {"common": 0, "uncommon": 1, "rare": 2, "epic": 2, "legendary": 3}[q]
	count = mini(count, randi() % 2 + (1 if count > 0 else 0))
	var result := []
	for _i in count:
		var pool: Array = Data.BONUS_POOL.duplicate()
		pool.shuffle()
		var entry: Dictionary = pool[0]
		var val := entry["min"] + randi() % (entry["max"] - entry["min"] + 1)
		result.append({"stat": entry["stat"], "val": val, "label": entry["label"]})
	return result


# ─── Inventory helpers ────────────────────────────────────────

func _add_item(item_id: String, qty: int = 1) -> bool:
	var def: Dictionary = Data.ITEMS.get(item_id, {})
	if def.is_empty():
		return false
	# Stackable?
	if def.get("stack", 1) > 1:
		for i in INV_SIZE:
			if inventory[i] and inventory[i]["id"] == item_id:
				inventory[i]["qty"] = mini(inventory[i]["qty"] + qty, def["stack"])
				inventory_changed.emit()
				return true
	# Find empty slot
	for i in INV_SIZE:
		if inventory[i] == null:
			inventory[i] = make_instance(item_id, qty)
			inventory_changed.emit()
			return true
	notification.emit("Inventario pieno!", "error")
	return false


func add_item(item_id: String, qty: int = 1) -> bool:
	return _add_item(item_id, qty)


func remove_item_at(slot: int, qty: int = 1) -> void:
	if slot < 0 or slot >= INV_SIZE or inventory[slot] == null:
		return
	inventory[slot]["qty"] -= qty
	if inventory[slot]["qty"] <= 0:
		inventory[slot] = null
	inventory_changed.emit()


func find_item(item_id: String) -> int:
	for i in INV_SIZE:
		if inventory[i] and inventory[i]["id"] == item_id:
			return i
	return -1


func count_item(item_id: String) -> int:
	var total := 0
	for i in INV_SIZE:
		if inventory[i] and inventory[i]["id"] == item_id:
			total += inventory[i]["qty"]
	return total


# ─── Equip / unequip ──────────────────────────────────────────

func equip_item(inv_slot: int) -> void:
	var inst := inventory[inv_slot]
	if inst == null:
		return
	var def: Dictionary = Data.ITEMS[inst["id"]]
	if not def.has("slot"):
		return
	var eq_slot: String = def["slot"]
	# Level check
	if def.get("lvl", 1) > player_data["level"]:
		notification.emit("Livello insufficiente!", "error")
		return
	# Swap: put existing equipped back to inventory
	if equipped.has(eq_slot):
		inventory[inv_slot] = equipped[eq_slot]
		equipped[eq_slot] = inst
	else:
		equipped[eq_slot] = inst
		inventory[inv_slot] = null
	recalc_stats()
	inventory_changed.emit()
	notification.emit("Equipaggiato: %s" % def["name"], "success")


func unequip_item(eq_slot: String) -> void:
	if not equipped.has(eq_slot):
		return
	for i in INV_SIZE:
		if inventory[i] == null:
			inventory[i] = equipped[eq_slot]
			equipped.erase(eq_slot)
			recalc_stats()
			inventory_changed.emit()
			return
	notification.emit("Inventario pieno!", "error")


# ─── Stat recalculation ───────────────────────────────────────

func recalc_stats() -> void:
	var cls: Dictionary = Data.CLASSES[player_data["class"]]
	var g: Dictionary = cls["growth"]
	var lvl: int = player_data["level"]

	var base_atk  := cls["base"]["atk"]  + g["atk"]  * (lvl - 1)
	var base_matk := cls["base"]["matk"] + g["matk"] * (lvl - 1)
	var base_def  := cls["base"]["def"]  + g["def"]  * (lvl - 1)
	var base_hp   := cls["base"]["hp"]   + g["hp"]   * (lvl - 1)
	var base_mp   := cls["base"]["mp"]   + g["mp"]   * (lvl - 1)
	var base_spd  := cls["base"]["speed"]
	var bonus_crit: float = cls["base"]["crit"]

	var atk_flat := 0; var matk_flat := 0; var def_flat := 0
	var hp_flat  := 0; var mp_flat   := 0
	var atk_pct  := 1.0; var matk_pct := 1.0; var def_pct := 1.0; var spd_pct := 1.0

	# Equipment
	for eq_slot in equipped:
		var inst: Dictionary = equipped[eq_slot]
		var def: Dictionary = Data.ITEMS[inst["id"]]
		var enh_mult := 1.0 + 0.1 * inst["enh"]
		atk_flat  += int(def.get("atk",  0) * enh_mult)
		matk_flat += int(def.get("matk", 0) * enh_mult)
		def_flat  += int(def.get("def",  0) * enh_mult)
		hp_flat   += def.get("hp",   0)
		mp_flat   += def.get("mp",   0)
		bonus_crit += def.get("crit", 0)
		# Random bonuses
		for b in inst["bonuses"]:
			match b["stat"]:
				"atk": atk_flat += b["val"]
				"matk": matk_flat += b["val"]
				"def": def_flat += b["val"]
				"hp": hp_flat += b["val"]
				"mp": mp_flat += b["val"]
				"crit": bonus_crit += b["val"]
		# Socketed gems
		for gem_id in inst.get("gems", []):
			if gem_id == "":
				continue
			var gdef: Dictionary = Data.ITEMS.get(gem_id, {})
			match gdef.get("stat", ""):
				"atk": atk_flat += gdef.get("val", 0)
				"matk": matk_flat += gdef.get("val", 0)
				"def": def_flat += gdef.get("val", 0)
				"hp": hp_flat += gdef.get("val", 0)
				"crit": bonus_crit += gdef.get("val", 0)

	# Buffs
	for b in buffs:
		match b["stat"]:
			"atk_pct":  atk_pct  += b["val"] / 100.0
			"matk_pct": matk_pct += b["val"] / 100.0
			"def_pct":  def_pct  += b["val"] / 100.0
			"speed_pct": spd_pct += b["val"] / 100.0

	# Mount speed
	if mount_active and equipped.has("mount"):
		var md: Dictionary = Data.ITEMS[equipped["mount"]["id"]]
		spd_pct *= md.get("speed_mult", 1.0)

	var old_max_hp := player_data["max_hp"]
	var old_max_mp := player_data["max_mp"]

	player_data["max_hp"] = int((base_hp + hp_flat))
	player_data["max_mp"] = int((base_mp + mp_flat))
	player_data["atk"]    = int((base_atk  + atk_flat)  * atk_pct)
	player_data["matk"]   = int((base_matk + matk_flat) * matk_pct)
	player_data["def"]    = int((base_def  + def_flat)  * def_pct)
	player_data["speed"]  = base_spd * spd_pct
	player_data["crit"]   = bonus_crit

	# Clamp HP/MP if max decreased
	if player_data["max_hp"] < old_max_hp:
		player_data["hp"] = mini(player_data["hp"], player_data["max_hp"])
	if player_data["max_mp"] < old_max_mp:
		player_data["mp"] = mini(player_data["mp"], player_data["max_mp"])

	player_stats_changed.emit()


# ─── XP / level up ────────────────────────────────────────────

func gain_xp(amount: int) -> void:
	player_data["xp"] += amount
	while player_data["xp"] >= Data.level_xp(player_data["level"]):
		player_data["xp"] -= Data.level_xp(player_data["level"])
		player_data["level"] += 1
		player_data["skill_pts"] += 1
		# Level-up stat recovery
		recalc_stats()
		player_data["hp"] = player_data["max_hp"]
		player_data["mp"] = player_data["max_mp"]
		level_up.emit(player_data["level"])
		notification.emit("LIVELLO %d!" % player_data["level"], "levelup")
	player_stats_changed.emit()


func gain_gold(amount: int) -> void:
	player_data["gold"] += amount


func spend_gold(amount: int) -> bool:
	if player_data["gold"] < amount:
		notification.emit("Oro insufficiente!", "error")
		return false
	player_data["gold"] -= amount
	player_stats_changed.emit()
	return true


# ─── Combat helpers ───────────────────────────────────────────

func calc_damage(attacker: Dictionary, defender: Dictionary, mult: float = 1.0, uses_matk: bool = false) -> int:
	var raw := attacker.get("matk" if uses_matk else "atk", 0) * mult
	var def_val := defender.get("def", 0)
	var dmg := maxi(1, int(raw * (100.0 / (100.0 + def_val))))
	var crit_chance := attacker.get("crit", 5) / 100.0
	if randf() < crit_chance:
		dmg = int(dmg * 1.8)
	return dmg


func use_potion() -> void:
	if player_data.get("potions", 0) <= 0:
		return
	var heal := int(player_data["max_hp"] * 0.30)
	player_data["hp"] = mini(player_data["hp"] + heal, player_data["max_hp"])
	player_data["potions"] -= 1
	player_stats_changed.emit()
	combat_message.emit("+%d PV" % heal, "heal")


func use_item_at(inv_slot: int) -> void:
	var inst := inventory[inv_slot]
	if inst == null:
		return
	var def: Dictionary = Data.ITEMS[inst["id"]]
	match def.get("kind", ""):
		"potion":
			var stat: String = def.get("stat", "hp")
			var val: int = def.get("val", 0)
			if stat == "hp":
				player_data["hp"] = mini(player_data["hp"] + val, player_data["max_hp"])
				combat_message.emit("+%d PV" % val, "heal")
			elif stat == "mp":
				player_data["mp"] = mini(player_data["mp"] + val, player_data["max_mp"])
				combat_message.emit("+%d PM" % val, "heal")
			remove_item_at(inv_slot, 1)
			player_stats_changed.emit()
		"food":
			var dur: float = def.get("dur", 30.0)
			buffs.append({"stat": def["stat"], "val": def["val"], "dur": dur, "remains": dur, "name": def["name"]})
			remove_item_at(inv_slot, 1)
			recalc_stats()
			notification.emit("%s consumato!" % def["name"], "info")


func tick_buffs(delta: float) -> void:
	var to_remove := []
	for b in buffs:
		b["remains"] -= delta
		if b["remains"] <= 0.0:
			to_remove.append(b)
	for b in to_remove:
		buffs.erase(b)
	if to_remove.size() > 0:
		recalc_stats()


# ─── Quest system ─────────────────────────────────────────────

func accept_quest(quest_id: String) -> void:
	if active_quests.has(quest_id) or done_quests.has(quest_id):
		return
	var q: Dictionary = Data.QUESTS[quest_id]
	if player_data["level"] < q["lvl"]:
		notification.emit("Livello troppo basso per questa missione.", "error")
		return
	var progress := {}
	for goal_type in q["goals"]:
		for key in q["goals"][goal_type]:
			progress[key] = 0
	active_quests[quest_id] = {"id": quest_id, "progress": progress}
	notification.emit("Missione accettata: %s" % q["name"], "info")
	quest_updated.emit(quest_id)


func on_kill(mob_id: String) -> void:
	kill_counts[mob_id] = kill_counts.get(mob_id, 0) + 1
	for qid in active_quests.keys():
		var qa: Dictionary = active_quests[qid]
		var q: Dictionary = Data.QUESTS[qid]
		if q["goals"].has("kill") and q["goals"]["kill"].has(mob_id):
			qa["progress"][mob_id] = mini(qa["progress"].get(mob_id, 0) + 1, q["goals"]["kill"][mob_id])
			quest_updated.emit(qid)


func on_collect(item_id: String, qty: int = 1) -> void:
	for qid in active_quests.keys():
		var qa: Dictionary = active_quests[qid]
		var q: Dictionary = Data.QUESTS[qid]
		if q["goals"].has("collect") and q["goals"]["collect"].has(item_id):
			qa["progress"][item_id] = mini(qa["progress"].get(item_id, 0) + qty, q["goals"]["collect"][item_id])
			quest_updated.emit(qid)


func is_quest_complete(quest_id: String) -> bool:
	if not active_quests.has(quest_id):
		return false
	var qa: Dictionary = active_quests[quest_id]
	var q: Dictionary = Data.QUESTS[quest_id]
	for goal_type in q["goals"]:
		for key in q["goals"][goal_type]:
			if qa["progress"].get(key, 0) < q["goals"][goal_type][key]:
				return false
	return true


func turn_in_quest(quest_id: String) -> void:
	if not is_quest_complete(quest_id):
		return
	var q: Dictionary = Data.QUESTS[quest_id]
	gain_xp(q["rewards"]["xp"])
	gain_gold(q["rewards"]["gold"])
	for reward in q["rewards"]["items"]:
		add_item(reward[0], reward[1])
	active_quests.erase(quest_id)
	done_quests.append(quest_id)
	notification.emit("Missione completata: %s!" % q["name"], "success")
	quest_updated.emit(quest_id)


# ─── Save / Load ──────────────────────────────────────────────

func get_save_data() -> Dictionary:
	return {
		"player": player_data.duplicate(),
		"equipped": equipped.duplicate(true),
		"inventory": inventory.duplicate(true),
		"active_quests": active_quests.duplicate(true),
		"done_quests": done_quests.duplicate(),
		"kill_counts": kill_counts.duplicate(),
		"hair": hair_item,
	}


func load_save_data(data: Dictionary) -> void:
	player_data   = data.get("player",   player_data)
	equipped      = data.get("equipped", {})
	inventory     = data.get("inventory", inventory)
	active_quests = data.get("active_quests", {})
	done_quests   = data.get("done_quests", [])
	kill_counts   = data.get("kill_counts", {})
	hair_item     = data.get("hair", "")
	recalc_stats()
