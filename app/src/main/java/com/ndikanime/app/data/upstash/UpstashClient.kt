package com.ndikanime.app.data.upstash

import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

object UpstashClient {

    private const val BASE_URL = "https://pet-cattle-187211.upstash.io"
    private const val AUTH_TOKEN = "gQAAAAAAAttLAAIgcDJhNTJjMGViZWM1Njc0Zjg1OGJkZjI2NmZkYmU5ZWM1Nw"

    val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    suspend fun execute(vararg args: Any): JsonElement? = withContext(Dispatchers.IO) {
        try {
            val jsonBody = gson.toJson(args)
            val request = Request.Builder()
                .url(BASE_URL)
                .addHeader("Authorization", "Bearer $AUTH_TOKEN")
                .addHeader("Content-Type", "application/json")
                .post(jsonBody.toRequestBody(jsonMediaType))
                .build()

            okHttpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val bodyStr = response.body?.string() ?: return@withContext null
                val obj = gson.fromJson(bodyStr, JsonObject::class.java)
                return@withContext obj.get("result")
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun pipeline(commands: List<List<Any>>): JsonArray? = withContext(Dispatchers.IO) {
        try {
            val jsonBody = gson.toJson(commands)
            val request = Request.Builder()
                .url("$BASE_URL/pipeline")
                .addHeader("Authorization", "Bearer $AUTH_TOKEN")
                .addHeader("Content-Type", "application/json")
                .post(jsonBody.toRequestBody(jsonMediaType))
                .build()

            okHttpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val bodyStr = response.body?.string() ?: return@withContext null
                return@withContext gson.fromJson(bodyStr, JsonArray::class.java)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    // ===== CONVENIENCE HELPERS =====

    suspend fun get(key: String): String? {
        val res = execute("GET", key) ?: return null
        return if (res.isJsonPrimitive) res.asString else null
    }

    suspend fun set(key: String, value: String, exSeconds: Long? = null): Boolean {
        val args = if (exSeconds != null && exSeconds > 0) {
            arrayOf("SET", key, value, "EX", exSeconds.toString())
        } else {
            arrayOf("SET", key, value)
        }
        val res = execute(*args)
        return res != null
    }

    suspend fun del(vararg keys: String): Long {
        if (keys.isEmpty()) return 0
        val args = mutableListOf<Any>("DEL").apply { addAll(keys) }
        val res = execute(*args.toTypedArray())
        return res?.asLong ?: 0L
    }

    suspend fun lrange(key: String, start: Long, stop: Long): List<String> {
        val res = execute("LRANGE", key, start.toString(), stop.toString()) ?: return emptyList()
        if (!res.isJsonArray) return emptyList()
        val list = mutableListOf<String>()
        res.asJsonArray.forEach { elem ->
            if (elem.isJsonPrimitive) list.add(elem.asString)
        }
        return list
    }

    suspend fun lpush(key: String, vararg values: String): Long {
        if (values.isEmpty()) return 0
        val args = mutableListOf<Any>("LPUSH", key).apply { addAll(values) }
        val res = execute(*args.toTypedArray())
        return res?.asLong ?: 0L
    }

    suspend fun rpush(key: String, vararg values: String): Long {
        if (values.isEmpty()) return 0
        val args = mutableListOf<Any>("RPUSH", key).apply { addAll(values) }
        val res = execute(*args.toTypedArray())
        return res?.asLong ?: 0L
    }

    suspend fun ltrim(key: String, start: Long, stop: Long): Boolean {
        val res = execute("LTRIM", key, start.toString(), stop.toString())
        return res != null
    }

    suspend fun llen(key: String): Long {
        val res = execute("LLEN", key)
        return res?.asLong ?: 0L
    }

    suspend fun hget(key: String, field: String): String? {
        val res = execute("HGET", key, field) ?: return null
        return if (res.isJsonPrimitive) res.asString else null
    }

    suspend fun hset(key: String, field: String, value: String): Long {
        val res = execute("HSET", key, field, value)
        return res?.asLong ?: 0L
    }

    suspend fun hdel(key: String, vararg fields: String): Long {
        if (fields.isEmpty()) return 0
        val args = mutableListOf<Any>("HDEL", key).apply { addAll(fields) }
        val res = execute(*args.toTypedArray())
        return res?.asLong ?: 0L
    }

    suspend fun hgetall(key: String): Map<String, String> {
        val res = execute("HGETALL", key) ?: return emptyMap()
        val map = mutableMapOf<String, String>()
        if (res.isJsonArray) {
            val arr = res.asJsonArray
            var i = 0
            while (i < arr.size() - 1) {
                val k = arr[i].asString
                val v = arr[i + 1].asString
                map[k] = v
                i += 2
            }
        } else if (res.isJsonObject) {
            val obj = res.asJsonObject
            obj.keySet().forEach { k ->
                map[k] = obj.get(k).asString
            }
        }
        return map
    }

    suspend fun smembers(key: String): List<String> {
        val res = execute("SMEMBERS", key) ?: return emptyList()
        if (!res.isJsonArray) return emptyList()
        val list = mutableListOf<String>()
        res.asJsonArray.forEach { elem ->
            if (elem.isJsonPrimitive) list.add(elem.asString)
        }
        return list
    }

    suspend fun sadd(key: String, vararg members: String): Long {
        if (members.isEmpty()) return 0
        val args = mutableListOf<Any>("SADD", key).apply { addAll(members) }
        val res = execute(*args.toTypedArray())
        return res?.asLong ?: 0L
    }

    suspend fun srem(key: String, vararg members: String): Long {
        if (members.isEmpty()) return 0
        val args = mutableListOf<Any>("SREM", key).apply { addAll(members) }
        val res = execute(*args.toTypedArray())
        return res?.asLong ?: 0L
    }

    suspend fun zrevrange(key: String, start: Long, stop: Long): List<String> {
        val res = execute("ZREVRANGE", key, start.toString(), stop.toString()) ?: return emptyList()
        if (!res.isJsonArray) return emptyList()
        val list = mutableListOf<String>()
        res.asJsonArray.forEach { elem ->
            if (elem.isJsonPrimitive) list.add(elem.asString)
        }
        return list
    }

    suspend fun zadd(key: String, score: Double, member: String): Long {
        val res = execute("ZADD", key, score.toString(), member)
        return res?.asLong ?: 0L
    }

    suspend fun incrby(key: String, amount: Long): Long {
        val res = execute("INCRBY", key, amount.toString())
        return res?.asLong ?: 0L
    }
}
