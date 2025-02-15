<script setup>
import { ref, inject, onMounted } from "vue";

const { $mqtt } = useNuxtApp()
const topic = ref("gogo-pgc/remote/command");
const message = ref("");
const receivedMessages = ref([]);

onMounted(() => {
    if (!$mqtt) {
        console.error("❌ MQTT client is not available!");
        return;
    }

    $mqtt.on("message", (topic, msg) => {
        receivedMessages.value.unshift(`${topic}: ${msg.toString()}`);
    });
});

const publishMessage = () => {
    if ($mqtt && message.value.trim()) {
        $mqtt.publish(topic.value, message.value);
        message.value = "";
    }
};

const clearMessages = () => {
    receivedMessages.value = [];
};
</script>

<template>
    <div class="p-4 bg-gray-900 text-white h-screen flex flex-col">
        <h2 class="text-xl font-bold mb-4">MQTT Panel</h2>

        <div class="mb-4">
            <label class="block text-sm">Topic</label>
            <input v-model="topic" class="w-full p-2 bg-gray-700 text-white rounded" />
        </div>

        <div class="mb-4">
            <label class="block text-sm">Message</label>
            <input v-model="message" class="w-full p-2 bg-gray-700 text-white rounded" />
        </div>

        <button @click="publishMessage" class="bg-green-500 px-4 py-2 rounded hover:bg-green-600">
            Publish
        </button>

        <!-- Received Messages -->
        <div class="flex items-center justify-between mt-6">
            <h3 class="text-lg font-bold">Received Messages</h3>
            <button @click="clearMessages" class="p-2 text-red-500 hover:text-red-700 transition">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18"></path>
                    <path d="M8 6v14"></path>
                    <path d="M16 6v14"></path>
                    <path d="M5 6h14l-1 14H6L5 6z"></path>
                    <path d="M9 6V3h6v3"></path>
                </svg>
            </button>
        </div>
        <ul v-if="receivedMessages.length" class="mt-2 space-y-1 text-sm">
            <li v-for="msg in receivedMessages" :key="msg" class="bg-gray-800 p-2 rounded">
                {{ msg }}
            </li>
        </ul>
        <p v-else class="text-gray-500 text-sm">No messages received.</p>
    </div>
</template>
