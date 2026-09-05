package com.ndikanime.app.core

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlin.math.sin

object SoundManager {

    private val audioScope = CoroutineScope(Dispatchers.Default)
    var isSoundEnabled: Boolean = true

    private fun playTone(
        frequencies: List<Float>,
        durationMs: Int,
        amplitude: Float = 0.8f,
        envelopeType: String = "decay"
    ) {
        if (!isSoundEnabled) return
        audioScope.launch {
            try {
                val sampleRate = 44100
                val numSamples = (sampleRate * (durationMs / 1000.0)).toInt()
                val buffer = ShortArray(numSamples)

                for (i in 0 until numSamples) {
                    val time = i.toDouble() / sampleRate
                    var sampleVal = 0.0

                    for (freq in frequencies) {
                        sampleVal += sin(2.0 * Math.PI * freq * time)
                    }
                    sampleVal /= frequencies.size

                    val envelope = when (envelopeType) {
                        "decay" -> (1.0 - (i.toDouble() / numSamples))
                        "attack_decay" -> {
                            val attackSamples = numSamples * 0.2
                            if (i < attackSamples) (i / attackSamples) else (1.0 - ((i - attackSamples) / (numSamples - attackSamples)))
                        }
                        else -> 1.0
                    }

                    buffer[i] = (sampleVal * Short.MAX_VALUE * amplitude * envelope).toInt().toShort()
                }

                val audioTrack = AudioTrack.Builder()
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_GAME)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    .setAudioFormat(
                        AudioFormat.Builder()
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setSampleRate(sampleRate)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                            .build()
                    )
                    .setBufferSizeInBytes(buffer.size * 2)
                    .setTransferMode(AudioTrack.MODE_STATIC)
                    .build()

                audioTrack.write(buffer, 0, buffer.size)
                audioTrack.play()
                audioTrack.setNotificationMarkerPosition(numSamples)
                audioTrack.setPlaybackPositionUpdateListener(object : AudioTrack.OnPlaybackPositionUpdateListener {
                    override fun onPeriodicNotification(track: AudioTrack?) {}
                    override fun onMarkerReached(track: AudioTrack?) {
                        track?.release()
                    }
                })
            } catch (e: Exception) {
                // Ignore audio synthesizer errors
            }
        }
    }

    fun playHitSfx() {
        playTone(listOf(180f, 90f), 90, 0.7f, "decay")
    }

    fun playCritSfx() {
        playTone(listOf(880f, 1320f), 140, 0.9f, "decay")
    }

    fun playUltimateSfx() {
        playTone(listOf(523.25f, 659.25f, 783.99f, 1046.50f), 450, 0.9f, "attack_decay")
    }

    fun playVictorySfx() {
        audioScope.launch {
            playTone(listOf(523.25f), 120, 0.8f)
            kotlinx.coroutines.delay(100)
            playTone(listOf(659.25f), 120, 0.8f)
            kotlinx.coroutines.delay(100)
            playTone(listOf(783.99f), 120, 0.8f)
            kotlinx.coroutines.delay(100)
            playTone(listOf(1046.50f, 1318.51f), 400, 0.9f)
        }
    }

    fun playDefeatSfx() {
        audioScope.launch {
            playTone(listOf(440f), 150, 0.7f)
            kotlinx.coroutines.delay(120)
            playTone(listOf(370f), 150, 0.7f)
            kotlinx.coroutines.delay(120)
            playTone(listOf(311f), 350, 0.8f)
        }
    }

    fun playSummonFanfare() {
        audioScope.launch {
            playTone(listOf(440f, 880f), 100, 0.6f)
            kotlinx.coroutines.delay(80)
            playTone(listOf(554.37f, 1108.73f), 100, 0.7f)
            kotlinx.coroutines.delay(80)
            playTone(listOf(659.25f, 1318.51f), 100, 0.8f)
            kotlinx.coroutines.delay(80)
            playTone(listOf(880f, 1760f), 500, 0.9f)
        }
    }

    fun playCoinSfx() {
        audioScope.launch {
            playTone(listOf(987.77f), 60, 0.6f)
            kotlinx.coroutines.delay(50)
            playTone(listOf(1318.51f), 180, 0.7f)
        }
    }

    fun playLevelUpSfx() {
        audioScope.launch {
            playTone(listOf(440f, 554f), 100, 0.7f)
            kotlinx.coroutines.delay(90)
            playTone(listOf(554f, 659f), 100, 0.7f)
            kotlinx.coroutines.delay(90)
            playTone(listOf(659f, 880f), 350, 0.85f)
        }
    }
}
