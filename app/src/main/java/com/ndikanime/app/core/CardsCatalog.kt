package com.ndikanime.app.core

enum class CardRarity(val label: String, val colorHex: Long, val baseRate: Double, val dustValue: Int) {
    C("C", 0xFF94A3B8, 0.50, 10),
    R("R", 0xFF06B6D4, 0.35, 30),
    SR("SR", 0xFFA855F7, 0.11, 100),
    SSR("SSR", 0xFFF59E0B, 0.035, 400),
    UR("UR", 0xFFFF2A70, 0.005, 1500)
}

enum class CardElement(val label: String, val iconRes: String, val colorHex: Long) {
    FIRE("Fire", "🔥", 0xFFFF4500),
    WATER("Water", "💧", 0xFF00BFFF),
    WIND("Wind", "🌪️", 0xFF00FA9A),
    EARTH("Earth", "🌿", 0xFF8B4513),
    LIGHTNING("Lightning", "⚡", 0xFFFFD700),
    ICE("Ice", "❄️", 0xFFA0E6FF),
    LIGHT("Light", "✨", 0xFFFFFACD),
    DARKNESS("Darkness", "🌑", 0xFF4B0082),
    VOID("Void", "🌌", 0xFF8A2BE2),
    TIME("Time", "⏳", 0xFFDAA520),
    SPACE("Space", "🌠", 0xFF4169E1),
    CHAOS("Chaos", "💥", 0xFFFF1493),
    HOLY("Holy", "🕊️", 0xFFF0F8FF),
    POISON("Poison", "🧪", 0xFF32CD32),
    BLOOD("Blood", "🩸", 0xFF8B0000),
    GRAVITY("Gravity", "🪐", 0xFF483D8B),
    SOUND("Sound", "🎵", 0xFFFF69B4),
    METAL("Metal", "⚔️", 0xFFC0C0C0),
    COSMIC("Cosmic", "🔮", 0xFF9400D3),
    SOLAR("Solar", "☀️", 0xFFFF8C00),
    LUNAR("Lunar", "🌙", 0xFF7B68EE),
    DIVINE("Divine", "👑", 0xFFFFDF00)
}

data class CardModel(
    val id: String,
    val name: String,
    val animeOrigin: String,
    val rarity: CardRarity,
    val element: CardElement,
    val imageUrl: String,
    val baseHp: Int,
    val baseAtk: Int,
    val baseDef: Int,
    val baseSpd: Int,
    val critRate: Float = 0.15f,
    val skillName: String,
    val skillDescription: String,
    val ultimateName: String,
    val ultimateDescription: String,
    var stars: Int = 1,
    var level: Int = 1,
    var duplicates: Int = 0
) {
    val starMultiplier: Float
        get() = when (stars) {
            1 -> 1.0f
            2 -> 1.25f
            3 -> 1.55f
            4 -> 1.85f
            5 -> 2.25f
            else -> 1.0f
        }

    val levelMultiplier: Float
        get() = 1.0f + (level - 1) * 0.05f

    val effectiveHp: Int
        get() = (baseHp * starMultiplier * levelMultiplier).toInt()

    val effectiveAtk: Int
        get() = (baseAtk * starMultiplier * levelMultiplier).toInt()

    val effectiveDef: Int
        get() = (baseDef * starMultiplier * levelMultiplier).toInt()

    val effectiveSpd: Int
        get() = (baseSpd * starMultiplier).toInt()

    val combatPower: Int
        get() = ((effectiveHp * 0.25f) + (effectiveAtk * 1.5f) + (effectiveDef * 0.8f) + (effectiveSpd * 1.2f)).toInt()
}

object CardsCatalog {
    val ALL_CARDS: List<CardModel> = listOf(
        // UR Tier
        CardModel(
            id = "ur_gojo",
            name = "Satoru Gojō",
            animeOrigin = "Jujutsu Kaisen",
            rarity = CardRarity.UR,
            element = CardElement.VOID,
            imageUrl = "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80",
            baseHp = 4200,
            baseAtk = 980,
            baseDef = 720,
            baseSpd = 160,
            critRate = 0.35f,
            skillName = "Infinity Barrier",
            skillDescription = "Negates 70% of incoming damage for 2 turns.",
            ultimateName = "Hollow Purple",
            ultimateDescription = "Deals 350% Void damage and ignores 50% DEF."
        ),
        CardModel(
            id = "ur_sung_jinwoo",
            name = "Sung Jin-Woo",
            animeOrigin = "Solo Leveling",
            rarity = CardRarity.UR,
            element = CardElement.DARKNESS,
            imageUrl = "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80",
            baseHp = 4500,
            baseAtk = 1050,
            baseDef = 680,
            baseSpd = 175,
            critRate = 0.40f,
            skillName = "Shadow Extraction",
            skillDescription = "Summons shadow soldiers increasing ATK by 40%.",
            ultimateName = "Arise: Monarch Domain",
            ultimateDescription = "Deals 400% Dark AoE damage and steals 25% HP."
        ),
        CardModel(
            id = "ur_rimuru",
            name = "Rimuru Tempest",
            animeOrigin = "Tensei Shitara Slime Datta Ken",
            rarity = CardRarity.UR,
            element = CardElement.DIVINE,
            imageUrl = "https://images.unsplash.com/photo-1563089145-599997674d42?w=600&auto=format&fit=crop&q=80",
            baseHp = 4800,
            baseAtk = 920,
            baseDef = 850,
            baseSpd = 150,
            critRate = 0.30f,
            skillName = "Gluttony Beelzebub",
            skillDescription = "Absorbs target energy and heals team by 30%.",
            ultimateName = "Megiddo",
            ultimateDescription = "Deals 380% Holy/Divine damage with 100% Hit rate."
        ),
        CardModel(
            id = "ur_gilgamesh",
            name = "Gilgamesh",
            animeOrigin = "Fate Series",
            rarity = CardRarity.UR,
            element = CardElement.SOLAR,
            imageUrl = "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80",
            baseHp = 4100,
            baseAtk = 1100,
            baseDef = 620,
            baseSpd = 155,
            critRate = 0.45f,
            skillName = "Gate of Babylon",
            skillDescription = "Launches continuous Noble Phantasms dealing 180% damage.",
            ultimateName = "Enuma Elish",
            ultimateDescription = "Unleashes the Sword of Rupture for 450% devastating Cosmic damage."
        ),
        // SSR Tier
        CardModel(
            id = "ssr_luffy_g5",
            name = "Monkey D. Luffy (Gear 5)",
            animeOrigin = "One Piece",
            rarity = CardRarity.SSR,
            element = CardElement.LIGHTNING,
            imageUrl = "https://images.unsplash.com/photo-1569701814287-25e227aa71c9?w=600&auto=format&fit=crop&q=80",
            baseHp = 3600,
            baseAtk = 820,
            baseDef = 600,
            baseSpd = 145,
            critRate = 0.28f,
            skillName = "Bajrang Gun",
            skillDescription = "Gigantic fist crush dealing 240% Lightning/Physical damage.",
            ultimateName = "Drums of Liberation",
            ultimateDescription = "Boosts SPD by 50% and deals 320% damage."
        ),
        CardModel(
            id = "ssr_naruto_baryon",
            name = "Naruto Uzumaki (Baryon)",
            animeOrigin = "Boruto / Naruto",
            rarity = CardRarity.SSR,
            element = CardElement.SOLAR,
            imageUrl = "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop&q=80",
            baseHp = 3500,
            baseAtk = 850,
            baseDef = 580,
            baseSpd = 160,
            critRate = 0.32f,
            skillName = "Kurama Impact",
            skillDescription = "Deals 220% Solar burn damage reducing target DEF by 30%.",
            ultimateName = "Baryon Rasengan",
            ultimateDescription = "Deals 340% pure life-draining damage."
        ),
        CardModel(
            id = "ssr_ichigo_bankai",
            name = "Ichigo Kurosaki (True Bankai)",
            animeOrigin = "Bleach: TYBW",
            rarity = CardRarity.SSR,
            element = CardElement.CHAOS,
            imageUrl = "https://images.unsplash.com/photo-1541562232579-512a21360020?w=600&auto=format&fit=crop&q=80",
            baseHp = 3400,
            baseAtk = 880,
            baseDef = 550,
            baseSpd = 165,
            critRate = 0.35f,
            skillName = "Gran Rey Getsuga",
            skillDescription = "Hybrid Hollow blade slash for 250% Chaos damage.",
            ultimateName = "Mugetsu Final Cleave",
            ultimateDescription = "360% Dark damage with guaranteed Critical Strike."
        ),
        CardModel(
            id = "ssr_frieren",
            name = "Frieren",
            animeOrigin = "Sousou no Frieren",
            rarity = CardRarity.SSR,
            element = CardElement.HOLY,
            imageUrl = "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80",
            baseHp = 3200,
            baseAtk = 900,
            baseDef = 540,
            baseSpd = 140,
            critRate = 0.25f,
            skillName = "Zoltraak (Demonslayer)",
            skillDescription = "Standard piercing magic dealing 230% Holy damage.",
            ultimateName = "Ancient Dispel Cataclysm",
            ultimateDescription = "Deals 330% Holy AoE damage and removes all enemy buffs."
        ),
        // SR Tier
        CardModel(
            id = "sr_tanjiro",
            name = "Tanjiro Kamado",
            animeOrigin = "Demon Slayer",
            rarity = CardRarity.SR,
            element = CardElement.FIRE,
            imageUrl = "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80",
            baseHp = 2600,
            baseAtk = 620,
            baseDef = 480,
            baseSpd = 135,
            critRate = 0.20f,
            skillName = "Hinokami Kagura: Clear Blue Sky",
            skillDescription = "Continuous circular slash dealing 180% Fire damage.",
            ultimateName = "Sun Halo Dragon Dance",
            ultimateDescription = "Deals 260% Fire damage and inflicts Burn."
        ),
        CardModel(
            id = "sr_zoro",
            name = "Roronoa Zoro",
            animeOrigin = "One Piece",
            rarity = CardRarity.SR,
            element = CardElement.WIND,
            imageUrl = "https://images.unsplash.com/photo-1569701814287-25e227aa71c9?w=600&auto=format&fit=crop&q=80",
            baseHp = 2700,
            baseAtk = 650,
            baseDef = 460,
            baseSpd = 130,
            critRate = 0.25f,
            skillName = "Oni Giri",
            skillDescription = "Swift three-sword cut dealing 190% Wind damage.",
            ultimateName = "King of Hell: Three Dragons",
            ultimateDescription = "Deals 280% Wind/Physical slash damage."
        ),
        CardModel(
            id = "sr_megumin",
            name = "Megumin",
            animeOrigin = "KonoSuba",
            rarity = CardRarity.SR,
            element = CardElement.FIRE,
            imageUrl = "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80",
            baseHp = 1800,
            baseAtk = 850,
            baseDef = 300,
            baseSpd = 110,
            critRate = 0.30f,
            skillName = "Chant of Explosion",
            skillDescription = "Charges spell power increasing ATK by 50% for 1 turn.",
            ultimateName = "EXPLOSION!",
            ultimateDescription = "Deals 350% Fire AoE damage but reduces self SPD to 0 for 1 turn."
        ),
        // R Tier
        CardModel(
            id = "r_eren_scout",
            name = "Eren Yeager (Scout)",
            animeOrigin = "Attack on Titan",
            rarity = CardRarity.R,
            element = CardElement.EARTH,
            imageUrl = "https://images.unsplash.com/photo-1541562232579-512a21360020?w=600&auto=format&fit=crop&q=80",
            baseHp = 2100,
            baseAtk = 480,
            baseDef = 380,
            baseSpd = 120,
            critRate = 0.15f,
            skillName = "ODM Gear Strike",
            skillDescription = "Hook and blade cut dealing 140% Physical damage.",
            ultimateName = "Attack Titan Bite",
            ultimateDescription = "Deals 200% Earth damage."
        ),
        CardModel(
            id = "r_anya",
            name = "Anya Forger",
            animeOrigin = "Spy x Family",
            rarity = CardRarity.R,
            element = CardElement.SOUND,
            imageUrl = "https://images.unsplash.com/photo-1563089145-599997674d42?w=600&auto=format&fit=crop&q=80",
            baseHp = 1900,
            baseAtk = 380,
            baseDef = 450,
            baseSpd = 125,
            critRate = 0.10f,
            skillName = "Hehehe Stare",
            skillDescription = "Distracts target lowering enemy ATK by 25%.",
            ultimateName = "Waku Waku Cheering",
            ultimateDescription = "Heals all allies by 25% max HP."
        ),
        // C Tier
        CardModel(
            id = "c_slime",
            name = "Forest Slime",
            animeOrigin = "Fantasy Realm",
            rarity = CardRarity.C,
            element = CardElement.WATER,
            imageUrl = "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop&q=80",
            baseHp = 1400,
            baseAtk = 300,
            baseDef = 280,
            baseSpd = 95,
            critRate = 0.05f,
            skillName = "Water Splash",
            skillDescription = "Deals 110% Water damage.",
            ultimateName = "Acid Bubble",
            ultimateDescription = "Deals 150% Water damage."
        ),
        CardModel(
            id = "c_goblin",
            name = "Goblin Warrior",
            animeOrigin = "Fantasy Realm",
            rarity = CardRarity.C,
            element = CardElement.EARTH,
            imageUrl = "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80",
            baseHp = 1500,
            baseAtk = 320,
            baseDef = 260,
            baseSpd = 100,
            critRate = 0.05f,
            skillName = "Club Slam",
            skillDescription = "Deals 115% Physical damage.",
            ultimateName = "Frenzy Charge",
            ultimateDescription = "Deals 160% Earth damage."
        )
    )

    fun getCardById(id: String): CardModel? {
        return ALL_CARDS.find { it.id == id }?.copy()
    }

    fun rollSingleCard(pityCounterSR: Int, pityCounterUR: Int): Pair<CardModel, String> {
        val rand = Math.random()
        val card: CardModel
        val reason: String

        if (pityCounterUR >= 89) {
            val urCards = ALL_CARDS.filter { it.rarity == CardRarity.UR }
            card = urCards.random().copy()
            reason = "UR Guaranteed Pity!"
        } else if (pityCounterSR >= 9) {
            val srOrBetter = ALL_CARDS.filter { it.rarity == CardRarity.SR || it.rarity == CardRarity.SSR || it.rarity == CardRarity.UR }
            card = srOrBetter.random().copy()
            reason = "SR+ Guaranteed Pity!"
        } else {
            val rarity = when {
                rand < CardRarity.UR.baseRate -> CardRarity.UR
                rand < CardRarity.UR.baseRate + CardRarity.SSR.baseRate -> CardRarity.SSR
                rand < CardRarity.UR.baseRate + CardRarity.SSR.baseRate + CardRarity.SR.baseRate -> CardRarity.SR
                rand < CardRarity.UR.baseRate + CardRarity.SSR.baseRate + CardRarity.SR.baseRate + CardRarity.R.baseRate -> CardRarity.R
                else -> CardRarity.C
            }
            val pool = ALL_CARDS.filter { it.rarity == rarity }
            card = (pool.ifEmpty { ALL_CARDS }).random().copy()
            reason = "Summoned ${card.rarity.name}!"
        }

        return Pair(card, reason)
    }
}
