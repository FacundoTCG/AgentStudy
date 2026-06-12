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
signal party_changed
signal guild_changed

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
var pvp_mode       := false

# ─── Guild ────────────────────────────────────────────────────
var guild_name : String = ""
var guild_tag  : String = ""
var guild_rank : String = "Membro"

# ─── Stall ────────────────────────────────────────────────────
var stall_active : bool  = false
var stall_items  : Array = []   # [{inv_slot, price, label}]

# ─── Party ────────────────────────────────────────────────────
var party : Array = []   # [{name, class, level, hp, max_hp, mp, max_mp}]

# ─── Kill streak ──────────────────────────────────────────────
var kill_streak    : int   = 0
var streak_timer   : float = 0.0
const STREAK_RESET := 6.0   # seconds without a kill to reset streak

# ─── Achievements ─────────────────────────────────────────────
var achievements   : Dictionary = {}   # id → true (completed)

const ACHIEVEMENT_DEFS := [
	# id, name, description, condition_type, condition_value, reward_xp, reward_gold, reward_sp
	["ach_lv5",    "Primo Passo",          "Raggiungi il livello 5",    "level",   5,   500,   200, 0],
	["ach_lv10",   "Avventuriero",         "Raggiungi il livello 10",   "level",  10,  1200,   500, 1],
	["ach_lv20",   "Veterano",             "Raggiungi il livello 20",   "level",  20,  4000,  2000, 1],
	["ach_lv30",   "Eroe",                 "Raggiungi il livello 30",   "level",  30, 10000,  5000, 2],
	["ach_lv50",   "Leggenda",             "Raggiungi il livello 50",   "level",  50, 40000, 20000, 3],
	["ach_k10",    "Cacciatore",           "Uccidi 10 nemici",          "kills",  10,   300,   100, 0],
	["ach_k100",   "Sterminatore",         "Uccidi 100 nemici",         "kills", 100,  2000,   800, 1],
	["ach_k500",   "Macchina da Guerra",   "Uccidi 500 nemici",         "kills", 500, 10000,  4000, 1],
	["ach_gold10k","Commerciante",         "Accumula 10.000 oro",       "gold", 10000, 1000,     0, 0],
	["ach_boss1",  "Cacciatore di Capi",   "Uccidi il Gran Khan",       "kill_id","boss_khan", 2000, 1000, 1],
	["ach_boss2",  "Cacciatore di Draghi", "Uccidi il Drago del Tramonto","kill_id","boss_dragon",15000,8000, 2],
	["ach_fish1",  "Pescatore Dilettante", "Pesca 1 pesce",             "fish",    1,   200,   100, 0],
	["ach_fish10", "Pescatore Esperto",    "Pesca 10 pesci",            "fish",   10,  1500,   500, 0],
	["ach_streak", "Streak!",              "Ottieni una kill streak ×10","streak", 10,  500,   300, 0],
]

# Set by startup screen before loading main scene
var pending_class := "guerriero"
var pending_name  := "Avventuriero"

var fish_caught   : int = 0   # total fish caught (for achievements)

const INV_SIZE := 45


func _ready() -> void:
	set_process(true)


func _process(delta: float) -> void:
	if kill_streak > 0:
		streak_timer -= delta
		if streak_timer <= 0.0:
			kill_streak = 0


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
		"gold"        : 100,
		"potions"     : 5,
		"kills"       : 0,
		"deaths"      : 0,
		"skill_pts"   : 0,
		"skill_lvls"  : {},
		"regen_bonus" : 0,
		"stat_pts"    : 0,
		"stat_str"    : 0,
		"stat_vit"    : 0,
		"stat_int"    : 0,
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

	var regen_bonus_val := 0
	# Buffs
	for b in buffs:
		match b["stat"]:
			"atk_pct":   atk_pct        += b["val"] / 100.0
			"matk_pct":  matk_pct       += b["val"] / 100.0
			"def_pct":   def_pct        += b["val"] / 100.0
			"speed_pct": spd_pct        += b["val"] / 100.0
			"regen":     regen_bonus_val += int(b["val"])

	# Mount speed
	if mount_active and equipped.has("mount"):
		var md: Dictionary = Data.ITEMS[equipped["mount"]["id"]]
		spd_pct *= md.get("speed_mult", 1.0)

	# Stat point bonuses: STR→ATK+DEF, VIT→HP, INT→MATK+MP
	var s_str := player_data.get("stat_str", 0)
	var s_vit := player_data.get("stat_vit", 0)
	var s_int := player_data.get("stat_int", 0)
	atk_flat  += s_str * 2
	def_flat  += s_str + s_vit
	hp_flat   += s_vit * 25
	matk_flat += s_int * 2
	mp_flat   += s_int * 15

	var old_max_hp := player_data["max_hp"]
	var old_max_mp := player_data["max_mp"]

	player_data["max_hp"] = int((base_hp + hp_flat))
	player_data["max_mp"] = int((base_mp + mp_flat))
	player_data["atk"]    = int((base_atk  + atk_flat)  * atk_pct)
	player_data["matk"]   = int((base_matk + matk_flat) * matk_pct)
	player_data["def"]    = int((base_def  + def_flat)  * def_pct)
	player_data["speed"]        = base_spd * spd_pct
	player_data["crit"]         = bonus_crit
	player_data["regen_bonus"]  = regen_bonus_val

	# Clamp HP/MP if max decreased
	if player_data["max_hp"] < old_max_hp:
		player_data["hp"] = mini(player_data["hp"], player_data["max_hp"])
	if player_data["max_mp"] < old_max_mp:
		player_data["mp"] = mini(player_data["mp"], player_data["max_mp"])

	player_stats_changed.emit()


func add_stat_point(stat: String) -> void:
	if player_data.get("stat_pts", 0) <= 0:
		notification.emit("Nessun punto statistiche disponibile.", "error")
		return
	var key := "stat_%s" % stat
	if not player_data.has(key):
		return
	player_data["stat_pts"] -= 1
	player_data[key] += 1
	recalc_stats()
	notification.emit("+1 %s!" % stat.to_upper(), "success")


# ─── XP / level up ────────────────────────────────────────────

func gain_xp(amount: int, from_kill: bool = false) -> void:
	var mult := 1.0
	if from_kill and kill_streak >= 3:
		mult = 1.0 + minf(kill_streak * 0.05, 1.0)   # max 2× at 20 kills
	player_data["xp"] += int(amount * mult)
	while player_data["xp"] >= Data.level_xp(player_data["level"]):
		player_data["xp"] -= Data.level_xp(player_data["level"])
		player_data["level"] += 1
		player_data["skill_pts"] += 1
		player_data["stat_pts"]  = player_data.get("stat_pts", 0) + 3
		# Level-up stat recovery
		recalc_stats()
		player_data["hp"] = player_data["max_hp"]
		player_data["mp"] = player_data["max_mp"]
		level_up.emit(player_data["level"])
		notification.emit("LIVELLO %d!" % player_data["level"], "levelup")
	player_stats_changed.emit()
	check_achievements()


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

var last_crit := false   # set by calc_damage, read by callers for visuals


func calc_damage(attacker: Dictionary, defender: Dictionary, mult: float = 1.0, uses_matk: bool = false) -> int:
	var raw := attacker.get("matk" if uses_matk else "atk", 0) * mult
	var def_val := defender.get("def", 0)
	var dmg := maxi(1, int(raw * (100.0 / (100.0 + def_val))))
	var crit_chance := attacker.get("crit", 5) / 100.0
	last_crit = randf() < crit_chance
	if last_crit:
		dmg = int(dmg * 1.8)
	return dmg


func use_potion() -> void:
	if player_data.get("potions", 0) <= 0:
		notification.emit("Nessuna pozione!", "error")
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
		"fish":
			var hp_r: int = def.get("hp_restore", 0)
			if hp_r > 0:
				player_data["hp"] = mini(player_data["hp"] + hp_r, player_data["max_hp"])
				combat_message.emit("+%d PV" % hp_r, "heal")
			else:
				notification.emit("Il Pesce Abissale ti osserva in silenzio...", "info")
			remove_item_at(inv_slot, 1)
			player_stats_changed.emit()
		"skill_book":
			var target_class: String = def.get("class", "")
			if target_class != "" and target_class != player_data.get("class", ""):
				notification.emit("Questo libro è per un'altra classe!", "error")
				return
			var sk_id: String = def.get("skill_id", "")
			if sk_id == "":
				return
			var lvl := player_data.get("skill_lvls", {}).get(sk_id, 1)
			if lvl >= 10:
				notification.emit("Abilità già al livello massimo (10).", "error")
				return
			if not player_data.has("skill_lvls"):
				player_data["skill_lvls"] = {}
			player_data["skill_lvls"][sk_id] = lvl + 1
			remove_item_at(inv_slot, 1)
			player_stats_changed.emit()
			notification.emit("Abilità %s → Lv %d!" % [Data.SKILLS.get(sk_id, {}).get("name", sk_id), lvl + 1], "success")
			combat_message.emit("📖 ABILITÀ POTENZIATA!", "loot")


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
	player_data["kills"] = player_data.get("kills", 0) + 1
	# Kill streak
	kill_streak += 1
	streak_timer = STREAK_RESET
	if kill_streak in [5, 10, 20]:
		var mult_pct := int(minf(kill_streak * 5.0, 100.0))
		notification.emit("Kill streak x%d! XP +%d%%" % [kill_streak, mult_pct], "levelup")
	for qid in active_quests.keys():
		var qa: Dictionary = active_quests[qid]
		var q: Dictionary = Data.QUESTS[qid]
		if q["goals"].has("kill") and q["goals"]["kill"].has(mob_id):
			qa["progress"][mob_id] = mini(qa["progress"].get(mob_id, 0) + 1, q["goals"]["kill"][mob_id])
			quest_updated.emit(qid)
	check_achievements()


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


func check_achievements() -> void:
	for def in ACHIEVEMENT_DEFS:
		var ach_id: String = def[0]
		if achievements.has(ach_id):
			continue   # already claimed
		var ctype: String = def[4] if def[3] == "kill_id" else def[3]
		var cval = def[4]
		var met := false
		match def[3]:
			"level":
				met = player_data.get("level", 1) >= cval
			"kills":
				var total_kills := 0
				for k in kill_counts.values():
					total_kills += k
				met = total_kills >= cval
			"gold":
				met = player_data.get("gold", 0) >= cval
			"kill_id":
				met = kill_counts.get(cval, 0) >= 1
			"fish":
				met = fish_caught >= cval
			"streak":
				met = kill_streak >= cval
		if met:
			achievements[ach_id] = true
			var reward_xp  : int = def[5]
			var reward_gold: int = def[6]
			var reward_sp  : int = def[7]
			gain_xp(reward_xp)
			gain_gold(reward_gold)
			if reward_sp > 0:
				player_data["skill_pts"] = player_data.get("skill_pts", 0) + reward_sp
			notification.emit("🏆 Obiettivo: %s! +%d XP +%d 💰%s" % [
				def[1], reward_xp, reward_gold,
				("  +%d punto abilità" % reward_sp) if reward_sp > 0 else ""], "levelup")


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


# ─── Party system ─────────────────────────────────────────────

func invite_party_member(m_name: String, m_class: String, m_level: int) -> void:
	if party.size() >= 3:
		notification.emit("Il gruppo è pieno (max 4 totali).", "error")
		return
	var cls := Data.CLASSES.get(m_class, Data.CLASSES["guerriero"])
	var b   := cls.get("base", {})
	var gro := cls.get("growth", {})
	var hp := b.get("hp", 200) + gro.get("hp", 20) * (m_level - 1)
	var mp := b.get("mp", 80)  + gro.get("mp", 10) * (m_level - 1)
	party.append({"name": m_name, "class": m_class, "level": m_level,
		"hp": hp, "max_hp": hp, "mp": mp, "max_mp": mp})
	notification.emit("%s si è unito al gruppo!" % m_name, "success")
	party_changed.emit()


func remove_from_party(index: int) -> void:
	if index < 0 or index >= party.size():
		return
	var m_name := party[index].get("name", "?")
	party.remove_at(index)
	notification.emit("%s ha lasciato il gruppo." % m_name, "info")
	party_changed.emit()


func toggle_pvp() -> void:
	pvp_mode = not pvp_mode
	notification.emit("Modalità PvP: %s" % ("ATTIVA" if pvp_mode else "DISATTIVA"), "error" if pvp_mode else "info")
	player_stats_changed.emit()


# ─── Guild system ──────────────────────────────────────────────

func create_guild(g_name: String) -> void:
	if guild_name != "":
		notification.emit("Sei già in una gilda!", "error")
		return
	var trimmed := g_name.strip_edges()
	if trimmed.length() < 3:
		notification.emit("Il nome deve avere almeno 3 caratteri.", "error")
		return
	if not spend_gold(1000):
		return
	guild_name = trimmed
	guild_tag  = "[%s]" % trimmed.substr(0, 3).to_upper()
	guild_rank = "Fondatore"
	notification.emit("Gilda '%s' fondata!" % guild_name, "success")
	guild_changed.emit()
	player_stats_changed.emit()


func leave_guild() -> void:
	if guild_name == "":
		notification.emit("Non sei in nessuna gilda.", "error")
		return
	var old := guild_name
	guild_name = ""; guild_tag = ""; guild_rank = "Membro"
	notification.emit("Hai lasciato la gilda '%s'." % old, "info")
	guild_changed.emit()
	player_stats_changed.emit()


# ─── Stall system ──────────────────────────────────────────────

func open_stall() -> void:
	stall_active = true
	notification.emit("Stallo aperto! Premi T per chiuderlo.", "info")
	player_stats_changed.emit()


func close_stall() -> void:
	stall_active = false
	stall_items.clear()
	notification.emit("Stallo chiuso.", "info")
	player_stats_changed.emit()


func add_stall_item(inv_slot: int, price: int) -> void:
	if inventory[inv_slot] == null:
		return
	var def := Data.ITEMS.get(inventory[inv_slot]["id"], {})
	stall_items.append({"inv_slot": inv_slot, "price": price, "label": def.get("name", "?")})
	notification.emit("%s aggiunto allo stallo a %d 💰." % [def.get("name","?"), price], "info")


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
		"achievements": achievements.duplicate(),
		"fish_caught": fish_caught,
	}


func load_save_data(data: Dictionary) -> void:
	player_data   = data.get("player",   player_data)
	equipped      = data.get("equipped", {})
	inventory     = data.get("inventory", inventory)
	active_quests = data.get("active_quests", {})
	done_quests   = data.get("done_quests", [])
	kill_counts   = data.get("kill_counts", {})
	hair_item     = data.get("hair", "")
	achievements  = data.get("achievements", {})
	fish_caught   = data.get("fish_caught", 0)
	recalc_stats()
