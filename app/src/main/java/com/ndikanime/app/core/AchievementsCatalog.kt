package com.ndikanime.app.core

enum class AchievementTier(val label: String, val colorHex: Long) {
    BRONZE("Bronze", 0xFFCD7F32),
    SILVER("Silver", 0xFFC0C0C0),
    GOLD("Gold", 0xFFFFD700),
    PLATINUM("Platinum", 0xFF00E5FF)
}

enum class AchievementCategory(val label: String) {
    STREAMING("Streaming"),
    READING("Reading"),
    GACHA("Gacha & Cards"),
    ARENA("Combat & PvP"),
    TOWER("Tower of Champions"),
    SOCIAL("Social & Clan"),
    LEVEL("Progression")
}

data class AchievementItem(
    val id: String,
    val title: String,
    val description: String,
    val tier: AchievementTier,
    val category: AchievementCategory,
    val rewardCoins: Int,
    val rewardGems: Int = 0,
    val requiredProgress: Int,
    var currentProgress: Int = 0,
    var isUnlocked: Boolean = false
) {
    val progressPercent: Float
        get() = (currentProgress.toFloat() / requiredProgress).coerceIn(0f, 1f)
}

object AchievementsCatalog {
    val ALL_ACHIEVEMENTS: List<AchievementItem> = listOf(
        // Streaming
        AchievementItem("stream_1", "First Episode", "Watch your first anime episode.", AchievementTier.BRONZE, AchievementCategory.STREAMING, 100, 5, 1),
        AchievementItem("stream_10", "Marathon Starter", "Watch 10 anime episodes.", AchievementTier.BRONZE, AchievementCategory.STREAMING, 300, 10, 10),
        AchievementItem("stream_50", "Otaku in Training", "Watch 50 anime episodes.", AchievementTier.SILVER, AchievementCategory.STREAMING, 800, 25, 50),
        AchievementItem("stream_200", "Anime Connoisseur", "Watch 200 anime episodes.", AchievementTier.GOLD, AchievementCategory.STREAMING, 2500, 60, 200),
        AchievementItem("stream_500", "Dimension Resident", "Watch 500 anime episodes.", AchievementTier.PLATINUM, AchievementCategory.STREAMING, 8000, 200, 500),

        // Reading
        AchievementItem("read_1", "Page Turner", "Read your first manga chapter.", AchievementTier.BRONZE, AchievementCategory.READING, 100, 5, 1),
        AchievementItem("read_25", "Comic Enthusiast", "Read 25 manga chapters.", AchievementTier.BRONZE, AchievementCategory.READING, 400, 15, 25),
        AchievementItem("read_100", "Bookworm Legend", "Read 100 manga chapters.", AchievementTier.SILVER, AchievementCategory.READING, 1200, 40, 100),
        AchievementItem("read_300", "Library Scholar", "Read 300 manga chapters.", AchievementTier.GOLD, AchievementCategory.READING, 3500, 90, 300),
        AchievementItem("read_1000", "Scrollmaster Omniscient", "Read 1,000 manga chapters.", AchievementTier.PLATINUM, AchievementCategory.READING, 10000, 250, 1000),

        // Gacha & Cards
        AchievementItem("gacha_1", "Fateful Encounter", "Perform your first gacha summon.", AchievementTier.BRONZE, AchievementCategory.GACHA, 150, 5, 1),
        AchievementItem("gacha_10", "Collector's Spirit", "Perform 10 gacha pulls.", AchievementTier.BRONZE, AchievementCategory.GACHA, 500, 20, 10),
        AchievementItem("gacha_50", "Card Vault Explorer", "Perform 50 gacha pulls.", AchievementTier.SILVER, AchievementCategory.GACHA, 1500, 50, 50),
        AchievementItem("gacha_sr_first", "Purple Radiance", "Summon your first SR card.", AchievementTier.BRONZE, AchievementCategory.GACHA, 300, 10, 1),
        AchievementItem("gacha_ssr_first", "Golden Destiny", "Summon your first SSR card.", AchievementTier.SILVER, AchievementCategory.GACHA, 1000, 30, 1),
        AchievementItem("gacha_ur_first", "Mythic Ascension", "Summon a Mythic UR card!", AchievementTier.PLATINUM, AchievementCategory.GACHA, 5000, 150, 1),
        AchievementItem("card_5star", "Cosmic Perfection", "Upgrade any card to 5 Stars ★★★★★.", AchievementTier.GOLD, AchievementCategory.GACHA, 3000, 80, 1),

        // Combat & PvP
        AchievementItem("pvp_1", "Enter the Arena", "Fight in your first PvP match.", AchievementTier.BRONZE, AchievementCategory.ARENA, 100, 5, 1),
        AchievementItem("pvp_10", "Gladiator in Blood", "Win 10 PvP Arena matches.", AchievementTier.BRONZE, AchievementCategory.ARENA, 500, 20, 10),
        AchievementItem("pvp_50", "Arena Champion", "Win 50 PvP Arena matches.", AchievementTier.SILVER, AchievementCategory.ARENA, 2000, 60, 50),
        AchievementItem("pvp_grandmaster", "Grandmaster Sovereign", "Reach Grandmaster Rank (5000+ RP).", AchievementTier.PLATINUM, AchievementCategory.ARENA, 10000, 300, 5000),

        // Tower
        AchievementItem("tower_10", "Tower Initiate", "Clear Floor 10 in Tower of Champions.", AchievementTier.BRONZE, AchievementCategory.TOWER, 400, 15, 10),
        AchievementItem("tower_25", "Spire Climber", "Clear Floor 25 in Tower of Champions.", AchievementTier.SILVER, AchievementCategory.TOWER, 1500, 45, 25),
        AchievementItem("tower_50", "Peak Dominator", "Clear Floor 50 (Final Boss) in Tower.", AchievementTier.PLATINUM, AchievementCategory.TOWER, 7500, 200, 50),

        // Social & Clan
        AchievementItem("social_chat", "Voice of the Realm", "Send 20 messages in Global Chat.", AchievementTier.BRONZE, AchievementCategory.SOCIAL, 200, 10, 20),
        AchievementItem("clan_join", "Guild Oath", "Join or create a Clan.", AchievementTier.BRONZE, AchievementCategory.SOCIAL, 300, 10, 1),
        AchievementItem("w2g_host", "Cinema Host", "Host a Watch2gether room with friends.", AchievementTier.SILVER, AchievementCategory.SOCIAL, 800, 25, 1),
        AchievementItem("story_post", "Storyteller", "Post your first 24-hour Story.", AchievementTier.BRONZE, AchievementCategory.SOCIAL, 250, 10, 1),

        // Progression & RPG Level
        AchievementItem("lvl_10", "Rookie Knight", "Reach User Level 10.", AchievementTier.BRONZE, AchievementCategory.LEVEL, 500, 15, 10),
        AchievementItem("lvl_50", "Domain Master", "Reach User Level 50.", AchievementTier.SILVER, AchievementCategory.LEVEL, 2000, 50, 50),
        AchievementItem("lvl_100", "Anime God", "Reach User Level 100.", AchievementTier.GOLD, AchievementCategory.LEVEL, 6000, 150, 100),
        AchievementItem("streak_7", "Weekly Dedication", "Achieve a 7-day Login Streak.", AchievementTier.SILVER, AchievementCategory.LEVEL, 1000, 30, 7),
        AchievementItem("streak_30", "Unbreakable Will", "Achieve a 30-day Login Streak.", AchievementTier.PLATINUM, AchievementCategory.LEVEL, 5000, 150, 30)
    )

    fun getUserAchievements(): List<AchievementItem> {
        return ALL_ACHIEVEMENTS.map { it.copy() }
    }
}
