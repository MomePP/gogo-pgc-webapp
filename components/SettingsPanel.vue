<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { useChannel } from '~/composables/useChannel';

const { $mqtt } = useNuxtApp()

const topic = ref("gogo-pgc/remote/")
const { channel } = useChannel()

const received_messages = ref<{ time: string; payload: string }[]>([])
const show_messages = ref(true)
const is_connected = ref(false)

onMounted(() => {
    if (!$mqtt) {
        console.error("❌ MQTT client is not available!");
        return
    }

    $mqtt.on("message", (topic, msg) => {
        received_messages.value.push({
            time: new Date().toLocaleTimeString(),
            payload: msg.toString(),
        })
    })
});

const connectChannel = () => {
    if (!$mqtt) {
        console.error("❌ MQTT client is not available!")
        return
    }

    if (!channel.value) {
        console.warn("⚠️ Channel is empty.")
        return
    }

    const newTopic = topic.value + channel.value;

    $mqtt.subscribe(newTopic, (err) => {
        if (err) {
            console.error("❌ Failed to subscribe to topic:", err)
            is_connected.value = false
        } else {
            console.log("✅ Subscribed to topic:", newTopic)
            is_connected.value = true
        }
    })
};

const clearMessages = () => {
    received_messages.value = []
};


const toggleMessages = () => {
    show_messages.value = !show_messages.value
};

watch(channel, (_, oldVal) => {
    if (is_connected.value && oldVal) {
        const oldTopic = topic.value + oldVal

        $mqtt.unsubscribe(oldTopic, (err) => {
            if (err) {
                console.warn("⚠️ Failed to unsubscribe from old topic:", err)
            } else {
                console.log("🔌 Unsubscribed from:", oldTopic)
            }
        })
    }
    is_connected.value = false
})
</script>

<template>
    <div class="p-4 flex flex-col h-full">
        <h2 class="text-xl font-bold mb-4">Settings</h2>

        <div class="flex items-center justify-between mb-1">
            <label class="text-base font-medium">Receiving Channel</label>
            <span class="text-sm text-blue-400 hover:text-blue-300 cursor-help" title="MQTT topic to listen on">ⓘ</span>
        </div>
        <input v-model="channel" class="w-full mb-4 p-2 bg-gray-700 text-white rounded" />

        <button @click="connectChannel" :disabled="is_connected" :class="[
            'px-4 py-2 mb-4 rounded font-medium transition',
            is_connected ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
        ]">
            {{ is_connected ? '✅ Connected' : 'Connect' }}
        </button>

        <div class="flex items-center justify-between mb-2 cursor-pointer" @click="toggleMessages">
            <h3 class="text-base font-medium">Received Messages</h3>
            <svg :class="['w-5 h-5 transition-transform', show_messages ? 'rotate-180' : 'rotate-0']" fill="none"
                stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round"
                stroke-linejoin="round">
                <path d="M6 9l6 6 6-6" />
            </svg>
        </div>

        <transition name="fade">
            <div v-show="show_messages" class="flex flex-col flex-1 bg-gray-800 rounded p-2 text-sm">
                <div class="flex-1 overflow-y-auto min-h-0" style="max-height: calc(80vh - 10rem)">
                    <p v-if="!received_messages.length" class="text-gray-400">No messages received</p>
                    <ul>
                        <li v-for="(msg, index) in [...received_messages].reverse()" :key="index"
                            class="mb-1 px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-100 transition-colors duration-150">
                            <div class="text-xs text-gray-400 mb-0.5">
                                {{ msg.time }}
                            </div>
                            <div class="text-sm text-white font-mono break-words">
                                {{ msg.payload }}
                            </div>
                        </li>
                    </ul>
                </div>
                <div class="flex justify-end">
                    <button @click.stop="clearMessages" class="text-sm text-blue-400 mt-2 mr-2 hover:underline">
                        Clear
                    </button>
                </div>
            </div>
        </transition>
    </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: all 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
    transform: translateY(-5px);
}
</style>
