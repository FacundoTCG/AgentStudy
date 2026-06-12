extends Node
## Data — database statico di gioco: classi, abilità, oggetti, mostri, zone,
## NPC, negozi, missioni. Tutto generato proceduralmente, nessun asset esterno.

const WORLD_SIZE := 3200.0
const HALF := 1600.0

var CLASSES := {}
var SKILLS := {}
var ITEMS := {}
var MONSTERS := {}
var ZONES := []
var NPCS := {}
var SHOPS := {}
var QUESTS := {}
var DROP_POOLS := {}
var STONE_TIERS := []
var CRAFT_RECIPES := []   # Array of {name, ingredients:[{id,qty}], result_id, result_qty, gold_cost}

const EQUIP_SLOTS := ["weapon", "body", "head", "shield", "boots", "bracelet", "necklace", "earring", "ring"]
const ENHANCE_RATES := [95, 90, 85, 75, 65, 55, 45, 35, 25]
const SOCKETS_BY_QUALITY := {"common": 0, "uncommon": 1, "rare": 2, "epic": 2, "legendary": 3}

const QUALITY_COLORS := {
	"common": Color(0.82, 0.80, 0.75),
	"uncommon": Color(0.35, 0.85, 0.40),
	"rare": Color(0.35, 0.55, 1.00),
	"epic": Color(0.75, 0.35, 1.00),
	"legendary": Color(1.00, 0.65, 0.15),
}

const QUALITY_NAMES := {
	"common": "Comune", "uncommon": "Non Comune", "rare": "Raro",
	"epic": "Epico", "legendary": "Leggendario",
}

const BONUS_POOL := [
	{"stat": "atk", "min": 2, "max": 18, "label": "ATK"},
	{"stat": "matk", "min": 2, "max": 18, "label": "MATK"},
	{"stat": "def", "min": 2, "max": 14, "label": "DIF"},
	{"stat": "hp", "min": 10, "max": 120, "label": "PV"},
	{"stat": "mp", "min": 8, "max": 80, "label": "PM"},
	{"stat": "crit", "min": 1, "max": 8, "label": "Critico %"},
	{"stat": "speed", "min": 1, "max": 6, "label": "Velocità %"},
]


func _ready() -> void:
	_build_classes()
	_build_skills()
	_build_items()
	_build_zones()
	_build_monsters()
	_build_stones()
	_build_npcs()
	_build_shops()
	_build_quests()
	_build_recipes()


func level_xp(lvl: int) -> int:
	return int(100.0 * pow(float(lvl), 1.7))


# ───────────────────────────── CLASSI ─────────────────────────────

func _build_classes() -> void:
	CLASSES = {
		"guerriero": {
			"name": "Guerriero", "tag": "GU",
			"color": Color(0.75, 0.22, 0.17),
			"desc": "Forza bruta e resistenza. Scudo e spada in prima linea.",
			"base": {"hp": 180, "mp": 60, "atk": 16, "matk": 0, "def": 10, "speed": 9.0, "crit": 5},
			"growth": {"hp": 26, "mp": 6, "atk": 3.2, "matk": 0.0, "def": 2.0},
			"skills": ["fendente", "fendente_rotante", "grido_guerra", "carica", "spaccaossa", "muro_scudo", "terremoto", "furia_berserker"],
		},
		"ninja": {
			"name": "Ninja", "tag": "NJ",
			"color": Color(0.18, 0.60, 0.30),
			"desc": "Assassino agile: doppi pugnali, critici letali, veleni.",
			"base": {"hp": 140, "mp": 80, "atk": 18, "matk": 0, "def": 7, "speed": 10.5, "crit": 12},
			"growth": {"hp": 20, "mp": 8, "atk": 3.6, "matk": 0.0, "def": 1.4},
			"skills": ["pugnalata", "raffica", "passo_ombra", "lama_velenosa", "lancio_shuriken", "fumogena", "danza_lame", "assassinio"],
		},
		"mago": {
			"name": "Mago Oscuro", "tag": "MA",
			"color": Color(0.55, 0.25, 0.75),
			"desc": "Signore dell'oscurità: magie d'area devastanti.",
			"base": {"hp": 110, "mp": 160, "atk": 6, "matk": 20, "def": 5, "speed": 9.0, "crit": 6},
			"growth": {"hp": 16, "mp": 16, "atk": 1.0, "matk": 3.8, "def": 1.2},
			"skills": ["dardo_oscuro", "sfera_di_fuoco", "nova_gelida", "drenaggio", "scudo_arcano", "catena_di_fulmini", "maledizione", "meteorite"],
		},
		"sciamano": {
			"name": "Sciamano", "tag": "SC",
			"color": Color(0.20, 0.50, 0.72),
			"desc": "Guardiano degli spiriti: fulmini, cure e benedizioni.",
			"base": {"hp": 130, "mp": 140, "atk": 8, "matk": 17, "def": 7, "speed": 9.2, "crit": 6},
			"growth": {"hp": 19, "mp": 14, "atk": 1.4, "matk": 3.4, "def": 1.6},
			"skills": ["scossa_spirituale", "fulmine", "cura", "benedizione", "totem_guardiano", "radici", "tempesta", "ira_degli_spiriti"],
		},
	}


# ───────────────────────────── ABILITÀ (32) ─────────────────────────────
# kind: melee | aoe | proj | buff | heal | dash
# mult applicato ad atk o matk a seconda di "uses"

func _build_skills() -> void:
	var defs := [
		# Guerriero
		["fendente", "Fendente", "guerriero", 12, 3.0, "melee", {"mult": 1.7}],
		["fendente_rotante", "Fendente Rotante", "guerriero", 18, 5.0, "aoe", {"mult": 1.5, "radius": 4.0}],
		["grido_guerra", "Grido di Guerra", "guerriero", 25, 14.0, "buff", {"stat": "atk_pct", "val": 30, "dur": 10.0}],
		["carica", "Carica", "guerriero", 20, 8.0, "dash", {"mult": 1.4, "dist": 8.0, "status": "stun", "status_dur": 1.5}],
		["spaccaossa", "Spaccaossa", "guerriero", 28, 9.0, "melee", {"mult": 2.4, "status": "stun", "status_dur": 2.0}],
		["muro_scudo", "Muro di Scudo", "guerriero", 24, 16.0, "buff", {"stat": "def_pct", "val": 50, "dur": 8.0}],
		["terremoto", "Terremoto", "guerriero", 40, 13.0, "aoe", {"mult": 2.2, "radius": 6.0, "status": "slow", "status_dur": 3.0}],
		["furia_berserker", "Furia Berserker", "guerriero", 50, 25.0, "buff", {"stat": "atk_pct", "val": 50, "dur": 12.0}],
		# Ninja
		["pugnalata", "Pugnalata", "ninja", 10, 2.5, "melee", {"mult": 1.8}],
		["raffica", "Raffica di Lame", "ninja", 18, 5.0, "melee", {"mult": 0.8, "hits": 3}],
		["passo_ombra", "Passo dell'Ombra", "ninja", 16, 9.0, "dash", {"mult": 1.2, "dist": 9.0}],
		["lama_velenosa", "Lama Velenosa", "ninja", 20, 8.0, "melee", {"mult": 1.3, "status": "poison", "status_dur": 6.0}],
		["lancio_shuriken", "Lancio Shuriken", "ninja", 14, 4.0, "proj", {"mult": 1.6, "range": 16.0}],
		["fumogena", "Bomba Fumogena", "ninja", 22, 18.0, "buff", {"stat": "speed_pct", "val": 30, "dur": 8.0}],
		["danza_lame", "Danza delle Lame", "ninja", 30, 11.0, "aoe", {"mult": 1.9, "radius": 3.5}],
		["assassinio", "Assassinio", "ninja", 45, 20.0, "melee", {"mult": 3.2, "execute": 0.3}],
		# Mago Oscuro
		["dardo_oscuro", "Dardo Oscuro", "mago", 12, 2.5, "proj", {"mult": 1.8, "range": 18.0, "uses": "matk"}],
		["sfera_di_fuoco", "Sfera di Fuoco", "mago", 22, 6.0, "proj", {"mult": 2.0, "range": 16.0, "radius": 3.0, "uses": "matk"}],
		["nova_gelida", "Nova Gelida", "mago", 26, 9.0, "aoe", {"mult": 1.5, "radius": 5.0, "status": "slow", "status_dur": 4.0, "uses": "matk"}],
		["drenaggio", "Drenaggio Vitale", "mago", 24, 8.0, "proj", {"mult": 1.4, "range": 14.0, "leech": 0.6, "uses": "matk"}],
		["scudo_arcano", "Scudo Arcano", "mago", 28, 16.0, "buff", {"stat": "def_pct", "val": 60, "dur": 8.0}],
		["catena_di_fulmini", "Catena di Fulmini", "mago", 32, 10.0, "proj", {"mult": 1.7, "range": 16.0, "chain": 3, "uses": "matk"}],
		["maledizione", "Maledizione", "mago", 20, 9.0, "proj", {"mult": 0.8, "range": 16.0, "status": "weaken", "status_dur": 8.0, "uses": "matk"}],
		["meteorite", "Meteorite", "mago", 60, 24.0, "aoe", {"mult": 3.5, "radius": 6.0, "uses": "matk"}],
		# Sciamano
		["scossa_spirituale", "Scossa Spirituale", "sciamano", 10, 2.5, "melee", {"mult": 1.6, "uses": "matk"}],
		["fulmine", "Fulmine", "sciamano", 16, 4.0, "proj", {"mult": 1.9, "range": 16.0, "uses": "matk"}],
		["cura", "Cura degli Spiriti", "sciamano", 25, 8.0, "heal", {"pct": 0.30}],
		["benedizione", "Benedizione", "sciamano", 22, 18.0, "buff", {"stat": "atk_pct", "val": 25, "dur": 15.0}],
		["totem_guardiano", "Totem Guardiano", "sciamano", 30, 20.0, "buff", {"stat": "regen", "val": 3, "dur": 12.0}],
		["radici", "Radici Avvolgenti", "sciamano", 18, 8.0, "proj", {"mult": 1.0, "range": 14.0, "status": "root", "status_dur": 3.0, "uses": "matk"}],
		["tempesta", "Tempesta Furiosa", "sciamano", 38, 13.0, "aoe", {"mult": 2.2, "radius": 5.0, "uses": "matk"}],
		["ira_degli_spiriti", "Ira degli Spiriti", "sciamano", 48, 24.0, "buff", {"stat": "matk_pct", "val": 40, "dur": 12.0}],
	]
	for d in defs:
		var s: Dictionary = {"id": d[0], "name": d[1], "class": d[2], "mp": d[3], "cd": d[4], "kind": d[5]}
		s.merge(d[6])
		SKILLS[d[0]] = s


# ───────────────────────────── OGGETTI (~300) ─────────────────────────────

func _quality_for_tier(t: int, max_t: int) -> String:
	var f := float(t) / float(max_t)
	if f <= 0.2: return "common"
	if f <= 0.45: return "uncommon"
	if f <= 0.65: return "rare"
	if f <= 0.85: return "epic"
	return "legendary"


func _build_items() -> void:
	var wpn_base := {"guerriero": "Spada", "ninja": "Pugnali", "mago": "Bastone", "sciamano": "Campana"}
	var suffixes := ["di Ferro", "d'Acciaio", "di Bronzo Antico", "del Soldato", "della Sentinella",
		"di Giada", "d'Argento Lunare", "del Capitano", "delle Anime", "del Drago Bianco",
		"dell'Imperatore", "della Fenice", "dei Cieli", "del Crepuscolo", "degli Dei"]

	# Armi: 15 tier x 4 classi = 60
	for cls in wpn_base.keys():
		for t in range(1, 16):
			var id := "wpn_%s_%02d" % [cls, t]
			var magic: bool = (cls == "mago" or cls == "sciamano")
			ITEMS[id] = {
				"id": id, "name": "%s %s" % [wpn_base[cls], suffixes[t - 1]],
				"slot": "weapon", "class": cls, "lvl": maxi(1, t * 4 - 3),
				"atk": 0 if magic else 8 + t * 7,
				"matk": 8 + t * 7 if magic else 0,
				"quality": _quality_for_tier(t, 15), "price": 50 * t * t, "tier": ceili(t / 2.0),
			}

	# Armature corpo: 10 tier x 4 classi = 40
	for cls in CLASSES.keys():
		for t in range(1, 11):
			var id := "arm_body_%s_%02d" % [cls, t]
			ITEMS[id] = {
				"id": id, "name": "Armatura %s (%s)" % [suffixes[mini(t - 1, 14)], CLASSES[cls]["name"]],
				"slot": "body", "class": cls, "lvl": maxi(1, t * 6 - 5),
				"def": 5 + t * 5, "hp": t * 18,
				"quality": _quality_for_tier(t, 10), "price": 60 * t * t, "tier": mini(8, t),
			}

	# Elmi 12, scudi 10, stivali 10, bracciali 10
	var head_names := ["Cuffia di Cuoio", "Elmo di Ferro", "Elmo del Soldato", "Elmo Cornuto", "Cimiero di Giada",
		"Elmo Lunare", "Corona di Guerra", "Elmo delle Anime", "Elmo Draconico", "Elmo Imperiale", "Diadema della Fenice", "Corona degli Dei"]
	for i in range(12):
		var id := "arm_head_%02d" % (i + 1)
		ITEMS[id] = {"id": id, "name": head_names[i], "slot": "head", "lvl": maxi(1, i * 5 - 2),
			"def": 3 + i * 3, "hp": i * 12, "quality": _quality_for_tier(i + 1, 12), "price": 40 * (i + 1) * (i + 1), "tier": mini(8, ceili((i + 1) / 1.5))}

	var shield_names := ["Scudo di Legno", "Scudo di Ferro", "Scudo del Soldato", "Scudo Torre", "Scudo di Giada",
		"Scudo Lunare", "Scudo delle Anime", "Scudo Draconico", "Egida Imperiale", "Baluardo degli Dei"]
	for i in range(10):
		var id := "arm_shield_%02d" % (i + 1)
		ITEMS[id] = {"id": id, "name": shield_names[i], "slot": "shield", "lvl": maxi(1, i * 6 - 3),
			"def": 4 + i * 4, "quality": _quality_for_tier(i + 1, 10), "price": 45 * (i + 1) * (i + 1), "tier": mini(8, i + 1)}

	var boots_names := ["Sandali", "Stivali di Cuoio", "Stivali Chiodati", "Stivali del Viandante", "Stivali di Giada",
		"Stivali Lunari", "Stivali delle Anime", "Stivali Draconici", "Stivali Imperiali", "Calzari degli Dei"]
	for i in range(10):
		var id := "arm_boots_%02d" % (i + 1)
		ITEMS[id] = {"id": id, "name": boots_names[i], "slot": "boots", "lvl": maxi(1, i * 6 - 3),
			"def": 2 + i * 2, "speed": 1 + i, "quality": _quality_for_tier(i + 1, 10), "price": 40 * (i + 1) * (i + 1), "tier": mini(8, i + 1)}

	var brac_names := ["Bracciale di Rame", "Bracciale di Ferro", "Bracciale d'Argento", "Bracciale di Giada", "Bracciale Lunare",
		"Bracciale delle Anime", "Bracciale Draconico", "Bracciale Imperiale", "Bracciale della Fenice", "Bracciale degli Dei"]
	for i in range(10):
		var id := "jwl_bracelet_%02d" % (i + 1)
		ITEMS[id] = {"id": id, "name": brac_names[i], "slot": "bracelet", "lvl": maxi(1, i * 6 - 3),
			"atk": 2 + i * 2, "matk": 2 + i * 2, "quality": _quality_for_tier(i + 1, 10), "price": 55 * (i + 1) * (i + 1), "tier": mini(8, i + 1)}

	# Gioielli: collane 10, orecchini 10, anelli 10
	var jwl_mat := ["di Rame", "di Ferro", "d'Argento", "d'Oro", "di Giada", "di Perla Nera", "di Rubino", "di Zaffiro", "di Diamante", "degli Dei"]
	for i in range(10):
		var idn := "jwl_necklace_%02d" % (i + 1)
		ITEMS[idn] = {"id": idn, "name": "Collana %s" % jwl_mat[i], "slot": "necklace", "lvl": maxi(1, i * 6 - 3),
			"matk": 3 + i * 3, "mp": 10 + i * 10, "quality": _quality_for_tier(i + 1, 10), "price": 60 * (i + 1) * (i + 1), "tier": mini(8, i + 1)}
		var ide := "jwl_earring_%02d" % (i + 1)
		ITEMS[ide] = {"id": ide, "name": "Orecchini %s" % jwl_mat[i], "slot": "earring", "lvl": maxi(1, i * 6 - 3),
			"crit": 1 + i, "quality": _quality_for_tier(i + 1, 10), "price": 60 * (i + 1) * (i + 1), "tier": mini(8, i + 1)}
		var idr := "jwl_ring_%02d" % (i + 1)
		ITEMS[idr] = {"id": idr, "name": "Anello %s" % jwl_mat[i], "slot": "ring", "lvl": maxi(1, i * 6 - 3),
			"atk": 2 + i * 2, "hp": 15 + i * 12, "quality": _quality_for_tier(i + 1, 10), "price": 60 * (i + 1) * (i + 1), "tier": mini(8, i + 1)}

	# Gemme: 5 tipi x 5 gradi = 25
	var gem_types := {
		"rubino": {"name": "Rubino", "stat": "atk", "base": 4, "color": Color(0.9, 0.15, 0.2)},
		"zaffiro": {"name": "Zaffiro", "stat": "def", "base": 3, "color": Color(0.2, 0.4, 0.95)},
		"smeraldo": {"name": "Smeraldo", "stat": "hp", "base": 25, "color": Color(0.15, 0.8, 0.35)},
		"ametista": {"name": "Ametista", "stat": "matk", "base": 4, "color": Color(0.65, 0.3, 0.9)},
		"topazio": {"name": "Topazio", "stat": "crit", "base": 2, "color": Color(0.95, 0.75, 0.2)},
	}
	var grade_names := ["Grezzo", "Tagliato", "Raffinato", "Perfetto", "Leggendario"]
	for gt in gem_types.keys():
		var gd: Dictionary = gem_types[gt]
		for g in range(1, 6):
			var id := "gem_%s_g%d" % [gt, g]
			ITEMS[id] = {"id": id, "name": "%s %s" % [gd["name"], grade_names[g - 1]],
				"kind": "gem", "gem_type": gt, "grade": g, "stat": gd["stat"], "val": gd["base"] * g * g,
				"color": gd["color"], "quality": ["common", "uncommon", "rare", "epic", "legendary"][g - 1],
				"price": 100 * g * g * g, "stack": 50}

	# Cavalcature: 10
	var mount_names := ["Pony Marrone", "Cavallo Baio", "Destriero Nero", "Cavallo da Guerra", "Cervo Bianco",
		"Lupo della Steppa", "Tigre delle Nevi", "Cinghiale Corazzato", "Unicorno Spettrale", "Drago Terrestre"]
	var mount_colors := [Color(0.45, 0.30, 0.18), Color(0.55, 0.35, 0.2), Color(0.12, 0.1, 0.1), Color(0.4, 0.32, 0.28),
		Color(0.92, 0.92, 0.88), Color(0.5, 0.5, 0.55), Color(0.85, 0.88, 0.92), Color(0.35, 0.28, 0.2),
		Color(0.75, 0.78, 0.95), Color(0.25, 0.55, 0.3)]
	for i in range(10):
		var id := "mount_%02d" % (i + 1)
		ITEMS[id] = {"id": id, "name": mount_names[i], "kind": "mount", "lvl": maxi(1, i * 6 - 3),
			"speed_mult": 1.25 + i * 0.078, "color": mount_colors[i],
			"quality": _quality_for_tier(i + 1, 10), "price": 800 * (i + 1) * (i + 1)}

	# Capigliature: 18 (6 forme x 3 colori)
	var hair_shapes := ["Corto", "Lungo", "Coda", "Cresta", "Treccia", "Rasato"]
	var hair_colors := {"Nero": Color(0.08, 0.07, 0.07), "Castano": Color(0.35, 0.22, 0.12), "Biondo": Color(0.85, 0.72, 0.4)}
	var hi := 0
	for shape in hair_shapes:
		for cname in hair_colors.keys():
			hi += 1
			var id := "hair_%02d" % hi
			ITEMS[id] = {"id": id, "name": "Taglio %s %s" % [shape, cname], "kind": "hair",
				"shape": shape, "color": hair_colors[cname], "quality": "uncommon", "price": 500}

	# Pergamene / pietre
	ITEMS["pietra_raffinazione"] = {"id": "pietra_raffinazione", "name": "Pietra di Raffinazione", "kind": "scroll",
		"desc": "Necessaria per potenziare oltre +4.", "quality": "rare", "price": 1500, "stack": 50}
	ITEMS["pergamena_benedizione"] = {"id": "pergamena_benedizione", "name": "Pergamena della Benedizione", "kind": "scroll",
		"desc": "Protegge l'oggetto se il potenziamento fallisce.", "quality": "epic", "price": 5000, "stack": 50}
	ITEMS["pergamena_incantamento"] = {"id": "pergamena_incantamento", "name": "Pergamena dell'Incantamento", "kind": "scroll",
		"desc": "Rerolla i bonus di un oggetto.", "quality": "epic", "price": 4000, "stack": 50}

	# Materiali di zona: 16
	var mat_names := [["Zanna di Cinghiale", "Pelliccia Grigia"], ["Ragnatela Spessa", "Essenza Spettrale"],
		["Piuma d'Avvoltoio", "Stendardo Predone"], ["Zanna d'Orco", "Scaglia di Lucertola"],
		["Frammento d'Anima", "Acciaio Maledetto"], ["Scaglia d'Idra", "Erba di Palude"],
		["Sabbia Cremisi", "Bendaggio Antico"], ["Scaglia di Drago", "Cristallo delle Vette"]]
	for z in range(1, 9):
		for j in range(2):
			var id := "mat_z%d_%s" % [z, ["a", "b"][j]]
			ITEMS[id] = {"id": id, "name": mat_names[z - 1][j], "kind": "material", "tier": z,
				"quality": "common", "price": 8 * z * z, "stack": 99}

	# Cibi: 6
	var foods := [["cibo_01", "Riso al Vapore", "hp", 80], ["cibo_02", "Zuppa di Pesce", "mp", 60],
		["cibo_03", "Spiedino di Carne", "atk_pct", 10], ["cibo_04", "Tè di Giada", "matk_pct", 10],
		["cibo_05", "Stufato del Cacciatore", "def_pct", 10], ["cibo_06", "Vino di Prugna", "speed_pct", 10]]
	for f in foods:
		ITEMS[f[0]] = {"id": f[0], "name": f[1], "kind": "food", "stat": f[2], "val": f[3],
			"dur": 60.0, "quality": "common", "price": 50, "stack": 20}

	# Pozioni
	for p in [["pozione_rossa_s", "Pozione Rossa (S)", "hp", 80, 30], ["pozione_rossa_m", "Pozione Rossa (M)", "hp", 250, 120],
		["pozione_rossa_l", "Pozione Rossa (L)", "hp", 700, 400], ["pozione_blu_s", "Pozione Blu (S)", "mp", 60, 30],
		["pozione_blu_m", "Pozione Blu (M)", "mp", 200, 120], ["pozione_blu_l", "Pozione Blu (L)", "mp", 550, 400]]:
		ITEMS[p[0]] = {"id": p[0], "name": p[1], "kind": "potion", "stat": p[2], "val": p[3],
			"quality": "common", "price": p[4], "stack": 99}

	# Pool di drop per tier
	for t in range(1, 9):
		DROP_POOLS[t] = []
	for id in ITEMS.keys():
		var it: Dictionary = ITEMS[id]
		if it.has("slot") and it.has("tier"):
			var t: int = clampi(it["tier"], 1, 8)
			DROP_POOLS[t].append(id)

	# Canna da pesca
	ITEMS["canna_da_pesca"] = {"id": "canna_da_pesca", "name": "Canna da Pesca",
		"kind": "fishing_rod", "quality": "uncommon", "price": 200, "stack": 1,
		"desc": "Usata per pescare. Premi G vicino all'acqua."}

	# Pesci (6 tipi)
	for f in [
		["pesce_carpa",    "Carpa",                 50,  15, "common"],
		["pesce_trota",    "Trota Maculata",         80,  25, "common"],
		["pesce_branzino", "Branzino d'Argento",    120,  45, "uncommon"],
		["pesce_anguilla", "Anguilla Oscura",         60,  20, "common"],
		["pesce_salmone",  "Salmone Imperiale",      200,  80, "rare"],
		["pesce_mostro",   "Pesce Abissale",           0, 350, "epic"],
	]:
		ITEMS[f[0]] = {"id": f[0], "name": f[1], "kind": "fish",
			"hp_restore": f[2], "quality": f[4], "price": f[3], "stack": 20}

	# Libri di Abilità — uno per ogni skill (usabili solo dalla classe giusta)
	var book_defs := {
		"guerriero": ["fendente","fendente_rotante","grido_guerra","carica","spaccaossa","muro_scudo","terremoto","furia_berserker"],
		"ninja":     ["pugnalata","raffica","passo_ombra","lama_veleno","fumogena","danza_lame","assassinio","pioggia_kunai"],
		"mago":      ["dardo_fuoco","sfera_ghiaccio","nova_arcana","scudo_magico","drenaggio","catena_fulmini","maledizione","meteorite"],
		"sciamano":  ["scossa_terra","cura_natura","benedizione","totem_fuoco","radici","tempesta","ira_natura","fulmine_sacro"],
	}
	for cls in book_defs.keys():
		for sk_id in book_defs[cls]:
			if not SKILLS.has(sk_id):
				continue
			var bid := "book_%s" % sk_id
			var sk_name: String = SKILLS[sk_id].get("name", sk_id)
			ITEMS[bid] = {"id": bid, "name": "Libro: %s" % sk_name,
				"kind": "skill_book", "skill_id": sk_id, "class": cls,
				"quality": "rare", "price": 1200, "stack": 1,
				"desc": "Potenzia l'abilità %s di 1 livello (max 10)." % sk_name}


# ───────────────────────────── ZONE (8) ─────────────────────────────

func _build_zones() -> void:
	# Mondo 3200x3200 centrato in (0,0). Villaggio al centro (raggio ~220).
	# Le 8 zone sono disposte in anello attorno al villaggio.
	var defs := [
		[1, "Prati di Levante", Color(0.36, 0.52, 0.25), Vector2(700, 0)],
		[2, "Foresta degli Spiriti", Color(0.20, 0.38, 0.22), Vector2(520, 520)],
		[3, "Colline dei Predoni", Color(0.48, 0.42, 0.24), Vector2(0, 700)],
		[4, "Steppa Ardente", Color(0.55, 0.40, 0.20), Vector2(-520, 520)],
		[5, "Valle del Silenzio", Color(0.34, 0.34, 0.42), Vector2(-700, 0)],
		[6, "Palude Nebbiosa", Color(0.25, 0.36, 0.30), Vector2(-520, -520)],
		[7, "Deserto Cremisi", Color(0.60, 0.34, 0.22), Vector2(0, -700)],
		[8, "Picchi del Tramonto", Color(0.45, 0.40, 0.50), Vector2(520, -520)],
	]
	ZONES = []
	for d in defs:
		ZONES.append({"tier": d[0], "name": d[1], "color": d[2], "center": d[3], "radius": 380.0})


func zone_at(pos: Vector2) -> Dictionary:
	if pos.length() < 230.0:
		return {"tier": 0, "name": "Villaggio di Pietrascura"}
	var best := {}
	var best_d := 1e9
	for z in ZONES:
		var d: float = pos.distance_to(z["center"])
		if d < best_d:
			best_d = d
			best = z
	return best


# ───────────────────────────── MOSTRI (81) ─────────────────────────────

func _build_monsters() -> void:
	var zone_mob_names := [
		["Cinghiale Selvatico", "Lupo Grigio", "Volpe Rossa", "Cane Randagio", "Predone", "Arciere Predone", "Orso Bruno", "Capo Predone"],
		["Lupo Spettrale", "Ragno Velenoso", "Spirito Errante", "Corvo Maledetto", "Bandito della Foresta", "Arciere Oscuro", "Treant Corrotto", "Signore dei Banditi"],
		["Mercenario", "Sciacallo", "Avvoltoio Gigante", "Tagliagole", "Lanciere Predone", "Balestriere", "Campione Predone", "Khan dei Predoni"],
		["Scorpione Gigante", "Iena del Deserto", "Guerriero Orco", "Sciamano Orco", "Arciere Orco", "Lucertola di Fuoco", "Orco Berserker", "Signore della Guerra"],
		["Spettro Silente", "Armatura Animata", "Guardiano di Pietra", "Anima in Pena", "Necromante", "Evocatore Oscuro", "Cavaliere Maledetto", "Re dei Lamenti"],
		["Serpente di Palude", "Rospo Gigante", "Uomo Lucertola", "Strega della Palude", "Idra Minore", "Sanguisuga Regale", "Troll di Palude", "Antica Idra"],
		["Predatore delle Sabbie", "Scarabeo Corazzato", "Djinn Minore", "Guardiano della Tomba", "Mummia Reale", "Sciamano delle Dune", "Golem di Sabbia", "Faraone Dimenticato"],
		["Arpia delle Vette", "Yeti Feroce", "Drago Minore", "Cultista del Drago", "Campione Draconico", "Sacerdote del Drago", "Viverna Tempestosa", "Avatar del Drago"],
	]
	# ruoli: 0-2 pacifici/minion, 3-6 aggressivi, 7 champion
	var role_hp_mult := [0.8, 0.9, 1.0, 1.0, 1.15, 1.25, 1.5, 3.0]
	var role_atk_mult := [0.8, 0.9, 1.0, 1.1, 1.15, 1.2, 1.35, 1.8]

	for z in range(1, 9):
		for r in range(8):
			var id := "mob_z%d_%d" % [z, r]
			var lvl: int = (z - 1) * 7 + 1 + r
			var hp := int((20.0 + lvl * 16.0) * role_hp_mult[r])
			var atk := int((5.0 + lvl * 2.4) * role_atk_mult[r])
			MONSTERS[id] = {
				"id": id, "name": zone_mob_names[z - 1][r], "lvl": lvl, "zone": z,
				"hp": hp, "atk": atk, "def": int(lvl * 1.1),
				"xp": int(lvl * 14.0 * (2.0 if r == 7 else 1.0)),
				"gold": [3 + lvl * 2, 8 + lvl * 4],
				"aggressive": r >= 3, "champion": r == 7,
				"speed": 4.5 + (1.0 if r >= 3 else 0.0),
				"scale": 1.0 + r * 0.08 + (0.5 if r == 7 else 0.0),
				"drops": _mob_drops(z, r),
			}

	# 6 boss del mondo
	var bosses := [
		["boss_khan", "Gran Khan Sanguinario", 3, 24], ["boss_warlord", "Signore della Guerra Gor'Mak", 4, 31],
		["boss_lich", "Lich del Silenzio", 5, 38], ["boss_hydra", "Idra Antica Velenosa", 6, 45],
		["boss_pharaoh", "Faraone Eterno", 7, 52], ["boss_dragon", "Drago del Tramonto", 8, 60],
	]
	for b in bosses:
		MONSTERS[b[0]] = {
			"id": b[0], "name": b[1], "lvl": b[3], "zone": b[2],
			"hp": int(800.0 + b[3] * 120.0), "atk": int(20.0 + b[3] * 4.0), "def": int(b[3] * 2.0),
			"xp": b[3] * 120, "gold": [b[3] * 30, b[3] * 60],
			"aggressive": true, "champion": true, "boss": true,
			"speed": 5.5, "scale": 2.6,
			"drops": _boss_drops(b[2]),
		}

	# 2 boss dei dungeon
	MONSTERS["boss_bandit_king"] = {"id": "boss_bandit_king", "name": "Re dei Banditi", "lvl": 12, "zone": 2,
		"hp": 1800, "atk": 55, "def": 18, "xp": 1500, "gold": [400, 800], "aggressive": true,
		"champion": true, "boss": true, "speed": 5.5, "scale": 2.2, "drops": _boss_drops(3)}
	MONSTERS["boss_orc_overlord"] = {"id": "boss_orc_overlord", "name": "Sovrano degli Orchi", "lvl": 20, "zone": 4,
		"hp": 3600, "atk": 90, "def": 30, "xp": 3200, "gold": [800, 1600], "aggressive": true,
		"champion": true, "boss": true, "speed": 5.5, "scale": 2.4, "drops": _boss_drops(5)}


func _mob_drops(z: int, r: int) -> Array:
	var drops := [
		{"id": "mat_z%d_a" % z, "chance": 0.35, "qty": [1, 2]},
		{"id": "mat_z%d_b" % z, "chance": 0.20, "qty": [1, 1]},
		{"id": "pozione_rossa_s" if z <= 3 else "pozione_rossa_m", "chance": 0.10, "qty": [1, 1]},
	]
	var eq_chance := 0.06 + (0.10 if r == 7 else 0.0)
	drops.append({"pool": z, "chance": eq_chance})
	var g: int = clampi(ceili(z / 2.0), 1, 5)
	drops.append({"gem": g, "chance": 0.03})
	return drops


func _boss_drops(z: int) -> Array:
	var t: int = clampi(z, 1, 8)
	var drops := [
		{"pool": t, "chance": 1.0}, {"pool": t, "chance": 0.6},
		{"gem": clampi(ceili(t / 2.0) + 1, 1, 5), "chance": 0.5},
		{"id": "pietra_raffinazione", "chance": 0.4, "qty": [1, 2]},
		{"id": "pergamena_benedizione", "chance": 0.15, "qty": [1, 1]},
	]
	# 20% chance to drop a random skill book matching zone tier
	var all_books := []
	for id in ITEMS.keys():
		if ITEMS[id].get("kind") == "skill_book":
			all_books.append(id)
	if all_books.size() > 0:
		drops.append({"id": all_books[randi() % all_books.size()], "chance": 0.20})
	return drops


func random_gem(grade: int) -> String:
	var types := ["rubino", "zaffiro", "smeraldo", "ametista", "topazio"]
	return "gem_%s_g%d" % [types[randi() % types.size()], clampi(grade, 1, 5)]


# ───────────────────────── PIETRE DEMONIACHE (8 tier) ─────────────────────────

func _build_stones() -> void:
	STONE_TIERS = []
	for t in range(1, 9):
		var lvl := t * 7 - 3
		STONE_TIERS.append({
			"tier": t, "name": "Pietra Demoniaca %s" % ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"][t - 1],
			"lvl": lvl, "hp": 300 + t * 350, "xp": 150 + t * 200,
			"gold": [40 * t, 90 * t], "minion": "mob_z%d_0" % t,
		})


# ───────────────────────────── NPC (13) ─────────────────────────────

func _build_npcs() -> void:
	var defs := [
		["fabbro_bruno", "Fabbro Bruno", "Forgiatore", Vector2(30, -60), {"forge": true},
			"Benvenuto alla forgia! Posso potenziare il tuo equipaggiamento... se hai oro e coraggio."],
		["mercante_lin", "Mercante Lin", "Mercante d'Armi", Vector2(-50, -50), {"shop": "weapon_shop"},
			"Armi e armature, le migliori dei Regni! Dai un'occhiata."],
		["guaritrice_elara", "Guaritrice Elara", "Guaritrice", Vector2(0, 70), {"shop": "potion_shop", "heal": true, "quests": ["q01", "q02", "q03"]},
			"Che gli spiriti ti proteggano, viandante. Posso curare le tue ferite."],
		["oste_tom", "Oste Tom", "Oste", Vector2(70, 20), {"rest": true, "quests": ["q04"]},
			"Benvenuto alla Taverna del Cinghiale! Riposati, la strada è lunga."],
		["barbiera_zara", "Barbiera Zara", "Barbiera", Vector2(-80, 10), {"shop": "hair_shop", "barber": true},
			"Quel taglio non ti dona affatto. Siediti, ci penso io!"],
		["alchimista_morvan", "Alchimista Morvan", "Alchimista", Vector2(55, 55), {"shop": "gem_shop", "alchemy": true, "quests": ["q05"]},
			"Le gemme sussurrano segreti... tre uguali ne fanno una più pura."],
		["stalliere_rocco", "Stalliere Rocco", "Stalliere", Vector2(-40, 80), {"shop": "mount_shop"},
			"Cavalli, lupi, persino draghi! Tutti addestrati, parola di Rocco."],
		["incantatrice_lyra", "Incantatrice Lyra", "Incantatrice", Vector2(85, -25), {"shop": "scroll_shop"},
			"Pergamene di potere... maneggiale con rispetto."],
		["maestro_khan", "Maestro Khan", "Maestro d'Armi", Vector2(-70, -40), {"skills": true, "quests": ["q06", "q07"]},
			"La tecnica batte la forza. Allena le tue abilità, giovane."],
		["capitano_dorn", "Capitano Dorn", "Capitano della Guardia", Vector2(15, -85), {"quests": ["q08", "q09"]},
			"I mostri premono ai confini. I Regni hanno bisogno di eroi."],
		["nonna_mei", "Nonna Mei", "Cuoca", Vector2(-15, 90), {"shop": "food_shop", "quests": ["q10"]},
			"Hai fame, tesoro? La mia zuppa rimette in piedi anche i morti."],
		["thane_il_saggio", "Thane il Saggio", "Saggio", Vector2(-90, -15), {"quests": ["q11", "q12"]},
			"I Picchi del Tramonto nascondono un male antico... e tu potresti essere la chiave."],
		["cercatrice_mira", "Cercatrice Mira", "Esploratrice", Vector2(45, -45), {},
			"Ho mappato ogni zona dei Regni. Chiedi pure, se ti serve la rotta."],
	]
	for d in defs:
		NPCS[d[0]] = {"id": d[0], "name": d[1], "title": d[2], "pos": d[3], "services": d[4], "greeting": d[5]}


# ───────────────────────────── NEGOZI (8) ─────────────────────────────

func _build_shops() -> void:
	var weapon_items := []
	for cls in CLASSES.keys():
		for t in range(1, 7):
			weapon_items.append("wpn_%s_%02d" % [cls, t])
		for t in range(1, 5):
			weapon_items.append("arm_body_%s_%02d" % [cls, t])
	for i in range(1, 6):
		weapon_items.append("arm_head_%02d" % i)
		weapon_items.append("arm_shield_%02d" % i)
		weapon_items.append("arm_boots_%02d" % i)
	weapon_items.append("canna_da_pesca")
	SHOPS["weapon_shop"] = {"name": "Armi e Armature", "items": weapon_items}
	SHOPS["potion_shop"] = {"name": "Pozioni", "items": ["pozione_rossa_s", "pozione_rossa_m", "pozione_rossa_l",
		"pozione_blu_s", "pozione_blu_m", "pozione_blu_l"]}
	var gems := []
	for gt in ["rubino", "zaffiro", "smeraldo", "ametista", "topazio"]:
		gems.append("gem_%s_g1" % gt)
		gems.append("gem_%s_g2" % gt)
	SHOPS["gem_shop"] = {"name": "Gemme", "items": gems}
	var mounts := []
	for i in range(1, 11):
		mounts.append("mount_%02d" % i)
	SHOPS["mount_shop"] = {"name": "Cavalcature", "items": mounts}
	var hairs := []
	for i in range(1, 19):
		hairs.append("hair_%02d" % i)
	SHOPS["hair_shop"] = {"name": "Acconciature", "items": hairs}
	var scroll_items := ["pietra_raffinazione", "pergamena_benedizione", "pergamena_incantamento"]
	# First skill book for each class available in scroll shop
	for cls in ["guerriero","ninja","mago","sciamano"]:
		var sk_ids := CLASSES.get(cls, {}).get("skills", [])
		if sk_ids.size() > 0:
			var bid := "book_%s" % sk_ids[0]
			if ITEMS.has(bid):
				scroll_items.append(bid)
	SHOPS["scroll_shop"] = {"name": "Pergamene & Libri", "items": scroll_items}
	SHOPS["food_shop"] = {"name": "Cucina di Nonna Mei", "items": ["cibo_01", "cibo_02", "cibo_03", "cibo_04", "cibo_05", "cibo_06"]}
	var jwl := []
	for i in range(1, 6):
		jwl.append("jwl_bracelet_%02d" % i)
		jwl.append("jwl_necklace_%02d" % i)
		jwl.append("jwl_earring_%02d" % i)
		jwl.append("jwl_ring_%02d" % i)
	SHOPS["jewel_shop"] = {"name": "Gioielli", "items": jwl}


# ───────────────────────────── MISSIONI (12) ─────────────────────────────

func _build_quests() -> void:
	var defs := [
		["q01", "Cinghiali nei Prati", "guaritrice_elara", 1, {"kill": {"mob_z1_0": 6}},
			{"xp": 120, "gold": 80, "items": [["pozione_rossa_s", 3]]},
			"I cinghiali devastano i campi. Abbattine 6 nei Prati di Levante."],
		["q02", "Il Branco Grigio", "guaritrice_elara", 2, {"kill": {"mob_z1_1": 8}},
			{"xp": 200, "gold": 120, "items": [["arm_head_01", 1]]},
			"I lupi grigi si avvicinano troppo al villaggio. Riduci il branco: 8 lupi."],
		["q03", "Zanne per la Medicina", "guaritrice_elara", 3, {"collect": {"mat_z1_a": 5}},
			{"xp": 250, "gold": 150, "items": [["pozione_blu_s", 3]]},
			"Le zanne di cinghiale servono per un unguento. Portamene 5."],
		["q04", "Il Capo dei Predoni", "oste_tom", 5, {"kill": {"mob_z1_7": 1}},
			{"xp": 500, "gold": 400, "items": [["pietra_raffinazione", 1]]},
			"Un capo predone taglieggia i viandanti. Fagli visita... definitiva."],
		["q05", "Essenze Spettrali", "alchimista_morvan", 8, {"collect": {"mat_z2_b": 6}},
			{"xp": 800, "gold": 500, "items": [["gem_rubino_g2", 1]]},
			"Le essenze spettrali della Foresta alimentano la mia alchimia. Me ne servono 6."],
		["q06", "Prova del Guerriero", "maestro_khan", 10, {"kill": {"mob_z2_6": 5}},
			{"xp": 1200, "gold": 700, "items": []},
			"I treant corrotti sono avversari degni. Abbattine 5 e tornerai più forte."],
		["q07", "Il Khan dei Predoni", "maestro_khan", 16, {"kill": {"mob_z3_7": 1}},
			{"xp": 2500, "gold": 1500, "items": [["pergamena_benedizione", 1]]},
			"Il Khan dei Predoni raduna un esercito sulle Colline. Decapita il comando."],
		["q08", "Offensiva sulla Steppa", "capitano_dorn", 22, {"kill": {"mob_z4_2": 10, "mob_z4_4": 6}},
			{"xp": 4000, "gold": 2200, "items": [["pietra_raffinazione", 2]]},
			"Gli orchi della Steppa Ardente preparano un assalto. Colpisci per primo."],
		["q09", "Sussurri nel Silenzio", "capitano_dorn", 30, {"kill": {"mob_z5_4": 6}},
			{"xp": 6500, "gold": 3500, "items": [["gem_zaffiro_g3", 1]]},
			"I necromanti della Valle risvegliano i morti. Riportali al silenzio."],
		["q10", "Sapori di Palude", "nonna_mei", 36, {"collect": {"mat_z6_b": 8}},
			{"xp": 8000, "gold": 4000, "items": [["cibo_03", 5]]},
			"L'erba di palude dà quel tocco in più alla zuppa. Raccoglimene 8 mazzi."],
		["q11", "Il Faraone Dimenticato", "thane_il_saggio", 45, {"kill": {"boss_pharaoh": 1}},
			{"xp": 15000, "gold": 8000, "items": [["pergamena_incantamento", 1]]},
			"Nel Deserto Cremisi un re antico si è risvegliato. Rimandalo nella tomba."],
		["q12", "Il Signore dei Picchi", "thane_il_saggio", 55, {"kill": {"boss_dragon": 1}},
			{"xp": 30000, "gold": 20000, "items": [["gem_topazio_g5", 1]]},
			"L'Avatar del Drago domina i Picchi del Tramonto. Questa è la tua leggenda, eroe."],
	]
	for d in defs:
		QUESTS[d[0]] = {"id": d[0], "name": d[1], "giver": d[2], "lvl": d[3],
			"goals": d[4], "rewards": d[5], "desc": d[6]}


# ───────────────────────────── RICETTE DI FORGIATURA ─────────────────────────────

func _build_recipes() -> void:
	CRAFT_RECIPES = []
	# Zone 1: 5 materiali A → arma tier 3 guerriero
	for cls in CLASSES.keys():
		for t in range(1, 6):   # 5 ricette per classe (tier 3-7 armi)
			var wpn_id := "wpn_%s_%02d" % [cls, t + 2]
			if not ITEMS.has(wpn_id):
				continue
			var mat_a := "mat_z%d_a" % clampi(t, 1, 8)
			var mat_b := "mat_z%d_b" % clampi(t, 1, 8)
			CRAFT_RECIPES.append({
				"name": "Forgia: %s" % ITEMS[wpn_id]["name"],
				"ingredients": [{"id": mat_a, "qty": 4}, {"id": mat_b, "qty": 2}],
				"result_id": wpn_id, "result_qty": 1,
				"gold_cost": 800 * t,
			})
	# Armor recipes: body armor tier 3-6 for each class
	for cls in CLASSES.keys():
		for t in range(2, 6):
			var arm_id := "arm_body_%s_%02d" % [cls, t]
			if not ITEMS.has(arm_id):
				continue
			var mat_a := "mat_z%d_a" % clampi(t - 1, 1, 8)
			CRAFT_RECIPES.append({
				"name": "Forgia: %s" % ITEMS[arm_id]["name"],
				"ingredients": [{"id": mat_a, "qty": 5}, {"id": "pietra_raffinazione", "qty": 1}],
				"result_id": arm_id, "result_qty": 1,
				"gold_cost": 600 * t,
			})
	# Accessory recipes: bracciali e collane tier 3-5
	for i in range(2, 5):
		var brac := "jwl_bracelet_%02d" % (i + 1)
		var neck := "jwl_necklace_%02d" % (i + 1)
		var mat  := "mat_z%d_b" % clampi(i, 1, 8)
		if ITEMS.has(brac):
			CRAFT_RECIPES.append({
				"name": "Forgia: %s" % ITEMS[brac]["name"],
				"ingredients": [{"id": mat, "qty": 3}, {"id": "gem_rubino_g1", "qty": 1}],
				"result_id": brac, "result_qty": 1, "gold_cost": 400 * i,
			})
		if ITEMS.has(neck):
			CRAFT_RECIPES.append({
				"name": "Forgia: %s" % ITEMS[neck]["name"],
				"ingredients": [{"id": mat, "qty": 3}, {"id": "gem_ametista_g1", "qty": 1}],
				"result_id": neck, "result_qty": 1, "gold_cost": 400 * i,
			})
