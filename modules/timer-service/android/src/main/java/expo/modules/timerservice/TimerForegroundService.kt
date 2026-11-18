package expo.modules.timerservice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat

/**
 * Keeps the app (and the CPU) awake while a workout runs with the screen off,
 * shows a plain timer notification, and calls [onTick] every 200 ms on the main
 * thread. React Native pauses its own JS timers in the background, so these
 * native ticks are what drive the workout clock, sounds and voice.
 */
class TimerForegroundService : Service() {
  companion object {
    const val CHANNEL_ID = "bboks_timer_running"
    const val NOTIFICATION_ID = 4242
    const val EXTRA_TITLE = "title"
    const val EXTRA_TEXT = "text"
    private const val TICK_MS = 200L

    @Volatile var onTick: (() -> Unit)? = null
    @Volatile var running = false
    @Volatile var instance: TimerForegroundService? = null
  }

  fun updateNotification(title: String, text: String) {
    getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification(title, text))
  }

  private val handler = Handler(Looper.getMainLooper())
  private var wakeLock: PowerManager.WakeLock? = null
  private val ticker = object : Runnable {
    override fun run() {
      try { onTick?.invoke() } catch (_: Throwable) {}
      handler.postDelayed(this, TICK_MS)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "뽁타이머"
    val text = intent?.getStringExtra(EXTRA_TEXT) ?: ""
    val notification = buildNotification(title, text)
    instance = this

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    if (!running) {
      running = true
      val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
      wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "bboks:timer").apply {
        setReferenceCounted(false)
        acquire(4 * 60 * 60 * 1000L) // safety cap: 4 hours
      }
      handler.removeCallbacks(ticker)
      handler.post(ticker)
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    running = false
    instance = null
    handler.removeCallbacks(ticker)
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
    super.onDestroy()
  }

  private fun buildNotification(title: String, text: String): Notification {
    val nm = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(CHANNEL_ID) == null) {
      val channel = NotificationChannel(CHANNEL_ID, "운동 중 타이머", NotificationManager.IMPORTANCE_LOW).apply {
        description = "운동하는 동안 화면이 꺼져도 타이머가 돌아가게 해요"
        setShowBadge(false)
        setSound(null, null)
        enableVibration(false)
      }
      nm.createNotificationChannel(channel)
    }
    val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val contentIntent = launch?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    val icon = applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_media_play
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(text)
      .setSmallIcon(resources.getIdentifier("notification_icon", "drawable", packageName).takeIf { it != 0 } ?: icon)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setShowWhen(false)
      .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .apply { contentIntent?.let { setContentIntent(it) } }
      .build()
  }
}
