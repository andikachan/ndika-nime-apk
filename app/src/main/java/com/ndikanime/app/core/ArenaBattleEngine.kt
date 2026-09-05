package com.ndikanime.app.core

import kotlin.math.max
import kotlin.math.min
import kotlin.random.Random

data class BattleFighter(
    val id: String,
    val name: String,
    val card: CardModel,
    var currentHp: Int,
    val maxHp: Int,
    var energy: Int = 0,
    val isPlayer: Boolean
) {
    val isAlive: Boolean get() = currentHp > 0
    val hpPercent: Float get() = if (maxHp > 0) (currentHp.toFloat() / maxHp).coerceIn(0f, 1f) else 0f
}

data class BattleLogEntry(
    val round: Int,
    val actorName: String,
    val isPlayer: Boolean,
    val actionName: String,
    val targetName: String,
    val damage: Int,
    val isCritical: Boolean,
    val isSkill: Boolean,
    val isUltimate: Boolean,
    val targetRemainingHp: Int,
    val elementalAdvantage: Float
)

data class BattleResult(
    val won: Boolean,
    val totalRounds: Int,
    val playerTeamInitial: List<CardModel>,
    val enemyTeamInitial: List<CardModel>,
    val logs: List<BattleLogEntry>,
    val expEarned: Int,
    val coinsEarned: Int,
    val rpEarned: Int
)

object ArenaBattleEngine {

    fun getElementMultiplier(attacker: CardElement, defender: CardElement): Float {
        if (attacker == CardElement.DIVINE) return 1.50f
        val advantageMap: Map<CardElement, Set<CardElement>> = mapOf(
            CardElement.FIRE to setOf(CardElement.WIND, CardElement.ICE, CardElement.METAL),
            CardElement.WATER to setOf(CardElement.FIRE, CardElement.BLOOD, CardElement.POISON),
            CardElement.WIND to setOf(CardElement.EARTH, CardElement.SOUND, CardElement.POISON),
            CardElement.EARTH to setOf(CardElement.LIGHTNING, CardElement.WATER, CardElement.GRAVITY),
            CardElement.LIGHTNING to setOf(CardElement.WATER, CardElement.METAL, CardElement.TIME),
            CardElement.ICE to setOf(CardElement.WIND, CardElement.EARTH, CardElement.BLOOD),
            CardElement.LIGHT to setOf(CardElement.DARKNESS, CardElement.BLOOD, CardElement.CHAOS),
            CardElement.DARKNESS to setOf(CardElement.LIGHT, CardElement.HOLY, CardElement.TIME),
            CardElement.VOID to setOf(CardElement.SPACE, CardElement.TIME, CardElement.COSMIC),
            CardElement.TIME to setOf(CardElement.SPACE, CardElement.SOUND),
            CardElement.SPACE to setOf(CardElement.GRAVITY, CardElement.METAL),
            CardElement.CHAOS to setOf(CardElement.HOLY, CardElement.DIVINE),
            CardElement.HOLY to setOf(CardElement.DARKNESS, CardElement.BLOOD, CardElement.POISON),
            CardElement.POISON to setOf(CardElement.EARTH, CardElement.WATER),
            CardElement.BLOOD to setOf(CardElement.POISON, CardElement.EARTH),
            CardElement.GRAVITY to setOf(CardElement.SPACE, CardElement.EARTH),
            CardElement.SOUND to setOf(CardElement.WIND, CardElement.ICE),
            CardElement.METAL to setOf(CardElement.EARTH, CardElement.ICE),
            CardElement.COSMIC to setOf(CardElement.VOID, CardElement.SOLAR, CardElement.LUNAR),
            CardElement.SOLAR to setOf(CardElement.ICE, CardElement.DARKNESS, CardElement.LUNAR),
            CardElement.LUNAR to setOf(CardElement.SOLAR, CardElement.WATER)
        )

        val advantages = advantageMap[attacker] ?: emptySet()
        val disadvantages = advantageMap[defender] ?: emptySet()

        return when {
            advantages.contains(defender) -> 1.35f
            disadvantages.contains(attacker) -> 0.75f
            else -> 1.0f
        }
    }

    fun simulateBattle(
        playerDeck: List<CardModel>,
        enemyDeck: List<CardModel>
    ): BattleResult {
        val playerTeam = playerDeck.mapIndexed { idx, card ->
            BattleFighter(
                id = "p_$idx",
                name = card.name,
                card = card,
                currentHp = card.effectiveHp,
                maxHp = card.effectiveHp,
                isPlayer = true
            )
        }.toMutableList()

        val enemyTeam = enemyDeck.mapIndexed { idx, card ->
            BattleFighter(
                id = "e_$idx",
                name = card.name,
                card = card,
                currentHp = card.effectiveHp,
                maxHp = card.effectiveHp,
                isPlayer = false
            )
        }.toMutableList()

        val logs = mutableListOf<BattleLogEntry>()
        var round = 1
        val maxRounds = 30

        while (round <= maxRounds) {
            val allActive = (playerTeam.filter { it.isAlive } + enemyTeam.filter { it.isAlive })
                .sortedByDescending { it.card.effectiveSpd }

            if (playerTeam.none { it.isAlive } || enemyTeam.none { it.isAlive }) break

            for (actor in allActive) {
                if (!actor.isAlive) continue

                val opponents = if (actor.isPlayer) enemyTeam.filter { it.isAlive } else playerTeam.filter { it.isAlive }
                if (opponents.isEmpty()) break

                val target = opponents.minByOrNull { it.currentHp } ?: opponents.first()
                actor.energy = min(100, actor.energy + 35)

                val isUltimate = actor.energy >= 100
                val isSkill = !isUltimate && Random.nextFloat() < 0.40f
                val isCritical = Random.nextFloat() < actor.card.critRate

                val elementMultiplier = getElementMultiplier(actor.card.element, target.card.element)
                var rawAtk = actor.card.effectiveAtk.toFloat()

                val actionName: String
                if (isUltimate) {
                    rawAtk *= 3.0f
                    actionName = "Ultimate: ${actor.card.ultimateName}"
                    actor.energy = 0
                } else if (isSkill) {
                    rawAtk *= 1.8f
                    actionName = "Skill: ${actor.card.skillName}"
                } else {
                    actionName = "Normal Strike"
                }

                if (isCritical) {
                    rawAtk *= 1.5f
                }

                val defenseReduction = target.card.effectiveDef * 0.45f
                val finalDamage = max(50, ((rawAtk * elementMultiplier) - defenseReduction).toInt())

                target.currentHp = max(0, target.currentHp - finalDamage)

                logs.add(
                    BattleLogEntry(
                        round = round,
                        actorName = actor.name,
                        isPlayer = actor.isPlayer,
                        actionName = actionName,
                        targetName = target.name,
                        damage = finalDamage,
                        isCritical = isCritical,
                        isSkill = isSkill,
                        isUltimate = isUltimate,
                        targetRemainingHp = target.currentHp,
                        elementalAdvantage = elementMultiplier
                    )
                )

                if (opponents.none { it.isAlive }) break
            }

            round++
        }

        val playerWon = playerTeam.any { it.isAlive }
        val exp = if (playerWon) 350 + (round * 15) else 100
        val coins = if (playerWon) 250 + (round * 10) else 50
        val rp = if (playerWon) 25 else -12

        return BattleResult(
            won = playerWon,
            totalRounds = round - 1,
            playerTeamInitial = playerDeck,
            enemyTeamInitial = enemyDeck,
            logs = logs,
            expEarned = exp,
            coinsEarned = coins,
            rpEarned = rp
        )
    }
}
