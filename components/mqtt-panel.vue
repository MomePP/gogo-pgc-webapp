<script setup>
import { ref, inject, onMounted } from "vue";

const { $mqtt } = useNuxtApp()
const topic = ref("blockly/command");
const message = ref("");
const receivedMessages = ref([]);

onMounted(() => {
    if ($mqtt) {
        $mqtt.on("message", (topic, msg) => {
            receivedMessages.value.unshift(`${topic}: ${msg.toString()}`);
        });
    }
});

const publishMessage = () => {
    if ($mqtt && message.value.trim()) {
        $mqtt.publish(topic.value, message.value);
        console.log('publish: ', message.value)
        message.value = "";
    }
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

        <h3 class="text-lg font-bold mt-6">Received Messages</h3>
        <ul class="mt-2 space-y-1 text-sm">
            <li v-for="msg in receivedMessages" :key="msg" class="bg-gray-800 p-2 rounded">
                {{ msg }}
            </li>
        </ul>
    </div>
</template>
