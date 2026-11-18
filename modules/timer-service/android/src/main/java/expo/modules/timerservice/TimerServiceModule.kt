package expo.modules.timerservice

import android.content.Intent
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TimerServiceModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)

  override fun definition() = ModuleDefinition {
    Name("TimerService")

    Events("onTick")

    Function("start") { title: String, text: String ->
      TimerForegroundService.onTick = { sendEvent("onTick", emptyMap<String, Any>()) }
      val intent = Intent(context, TimerForegroundService::class.java)
        .putExtra(TimerForegroundService.EXTRA_TITLE, title)
        .putExtra(TimerForegroundService.EXTRA_TEXT, text)
      ContextCompat.startForegroundService(context, intent)
      true
    }

    Function("update") { title: String, text: String ->
      TimerForegroundService.instance?.updateNotification(title, text)
    }

    Function("stop") {
      TimerForegroundService.onTick = null
      context.stopService(Intent(context, TimerForegroundService::class.java))
    }

    OnDestroy {
      TimerForegroundService.onTick = null
      try { context.stopService(Intent(context, TimerForegroundService::class.java)) } catch (_: Throwable) {}
    }
  }
}
