<script setup lang='ts'>
import { ref, onMounted } from 'vue';

const { $mqtt } = useNuxtApp()
const remoteTopic = ref(useRuntimeConfig().public.mqttRemoteTopic || "");

const received_messages = ref<{ time: string; payload: string }[]>([])
const show_messages = ref(true)
const show_mqtt_info = ref(false)

onMounted(() => {
    if (!$mqtt) {
        console.error("❌ MQTT client is not available!");
        return
    }

    $mqtt.on("message", (topic, message) => {
        if (topic.startsWith(remoteTopic.value)) {
            received_messages.value.push({
                time: new Date().toLocaleTimeString(),
                payload: message.toString(),
            })
        }
    })
});

const clearMessages = () => {
    received_messages.value = []
};

const toggleMessages = () => {
    show_messages.value = !show_messages.value
};
</script>

<template>
    <div class="p-4 flex flex-col h-full">
        <h2 class="text-xl font-bold mb-6">Settings</h2>

        <div class="flex items-center justify-between mb-2 cursor-pointer" @click="toggleMessages">
            <h3 class="text-base font-medium">Message monitor</h3>
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

        <div class="mt-4">
            <button @click="show_mqtt_info = true" 
                class="text-sm text-blue-400 hover:text-blue-300 underline">
                View MQTT Settings Info
            </button>
        </div>

        <transition name="fade">
            <div v-if="show_mqtt_info"
                class="fixed inset-0 bg-black bg-opacity-50 z-100 flex items-center justify-center">
                <div class="bg-gray-900 text-white p-6 rounded shadow-lg max-w-xl w-full relative">
                    <h3 class="text-lg font-semibold mb-4">MQTT Settings Information</h3>
                    <p class="text-sm text-gray-300 mb-4">
                        The receiving channel determines which MQTT topic this app will subscribe to in order to receive
                        incoming messages. Make sure the topic matches the one used by your publisher.
                    </p>
                    <div class="mb-4 bg-gray-800 p-4 rounded text-sm border border-gray-700">
                        <h4 class="text-blue-400 font-semibold mb-2">Current MQTT Settings</h4>
                        <ul class="list-disc list-inside space-y-1">
                            <li><span class="text-gray-400">MQTT broker: </span>
                                <span class="text-white">broker.emqx.io</span>
                            </li>
                            <li>
                                <span class="text-gray-400">Record / Message logs topic: </span>
                                <span class="text-white">gogo-pgc/remote/&lt;channel&gt;</span>
                            </li>
                            <li>
                                <span class="text-gray-400">Playback topic: </span>
                                <span class="text-white">gogo-pgc/blockly/&lt;channel&gt;</span>
                            </li>
                        </ul>
                    </div>
                    <div class="flex justify-end">
                        <button @click="show_mqtt_info = false"
                            class="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded">
                            Close
                        </button>
                    </div>
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
