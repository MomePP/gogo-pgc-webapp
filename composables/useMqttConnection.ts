import { ref, watch, readonly } from 'vue'

const channel = ref<string>('')
const is_connected = ref(false)

export function useMqttConnection() {
  const { $mqtt } = useNuxtApp()
  const remoteTopic = ref(useRuntimeConfig().public.mqttRemoteTopic || "")

  // Save channel to localStorage whenever it connects successfully
  const saveChannel = () => {
    if (process.client) {
      localStorage.setItem('gogo_mqtt_channel', channel.value)
    }
  }

  const connectChannel = () => {
    if (!$mqtt) {
      console.error("❌ MQTT client is not available!")
      return
    }

    if (!channel.value) {
      console.warn("⚠️ Channel is empty.")
      return
    }

    const newTopic = remoteTopic.value + channel.value + "/#";

    $mqtt.subscribe(newTopic, (err) => {
      if (err) {
        console.error("❌ Failed to subscribe to topic:", err)
        is_connected.value = false
      } else {
        console.log("✅ Subscribed to channel:", channel.value)
        is_connected.value = true
        saveChannel() // Persist
      }
    })
  };

  // Watch for channel changes and unsubscribe from old channel
  watch(channel, (_, oldChannel) => {
    if (is_connected.value && oldChannel) {
      const oldTopic = remoteTopic.value + oldChannel + '/#'

      $mqtt.unsubscribe(oldTopic, (err) => {
        if (err) {
          console.warn("⚠️ Failed to unsubscribe from old topic:", err)
        } else {
          console.log("🔌 Unsubscribed from channel:", oldChannel)
        }
      })
    }
    is_connected.value = false
  });

  // Auto-connect on mount (client-side only)
  onMounted(() => {
    if (process.client && !channel.value) {
      const saved = localStorage.getItem('gogo_mqtt_channel')
      if (saved) {
        console.log("Found saved channel:", saved)
        channel.value = saved
        connectChannel()
      }
    }
  })

  return {
    channel,
    is_connected: readonly(is_connected),
    connectChannel
  }
}
