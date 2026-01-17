<script setup lang="ts">
import { useMqttConnection } from '~/composables/useMqttConnection'

const { is_connected } = useMqttConnection()
const { $mqtt } = useNuxtApp()

const received_messages = ref<{ time: string; payload: string; id: number }[]>([])
const isExpanded = ref(false)
const newMessagePulse = ref(false) // Track animation state
const remoteTopic = ref(useRuntimeConfig().public.mqttRemoteTopic || "")

const clearMessages = (e: Event) => {
    e.stopPropagation() // Prevent toggling the collapse when clicking clear
    received_messages.value = []
}

onMounted(() => {
    $mqtt?.on("message", (topic, message) => {
        if (topic.startsWith(remoteTopic.value)) {
            received_messages.value.unshift({
                id: Date.now(),
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                payload: message.toString(),
            })

            // Trigger the notification animation
            newMessagePulse.value = true
            setTimeout(() => { newMessagePulse.value = false }, 600)

            if (received_messages.value.length > 20) received_messages.value.pop()
        }
    })
})

// Watch for expansion to trigger resize
watch(isExpanded, () => {
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300)
})
</script>

<template>
    <div class="relative">
        <!-- Floating Pill -->
        <div @click="isExpanded = !isExpanded" :class="[
            'bg-white rounded-full shadow-lg border border-gray-100 px-4 py-2 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-all select-none',
            { 'noti-pulse': newMessagePulse && !isExpanded }
        ]">

            <div class="flex items-center gap-2 shrink-0">
                <!-- Only CLOUD Status Pill remains -->
                <div :class="[
                    is_connected ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-50 text-gray-400 border-gray-100',
                    'px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 border transition-colors'
                ]">
                    <span class="w-1.5 h-1.5 rounded-full" :class="is_connected ? 'bg-green-500' : 'bg-gray-300'"></span>
                    CLOUD
                </div>
            </div>
            
            <span class="text-sm font-bold text-gray-700 tracking-tight whitespace-nowrap">Activity Feed</span>

            <!-- Count badge with its own heart-beat animation -->
            <transition name="pop">
                <div v-if="received_messages.length > 0" :key="received_messages.length"
                    class="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-sm shadow-blue-200">
                    {{ received_messages.length }}
                </div>
            </transition>
        </div>

        <!-- Dropdown Card -->
        <transition name="dropdown">
            <div v-show="isExpanded"
                class="absolute top-12 right-0 w-80 bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 overflow-hidden z-50">
                <div class="p-3 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2 font-mono">Real-time
                        Logs</span>
                    <button @click="clearMessages"
                        class="text-[10px] font-bold text-blue-600 hover:text-blue-800 px-2 py-1 rounded">CLEAR</button>
                </div>

                <div class="max-h-60 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                    <div v-if="received_messages.length === 0" class="py-12 text-center text-gray-400 italic text-xs">
                        Listening for board activity...
                    </div>

                    <div v-for="msg in received_messages" :key="msg.id"
                        class="p-2.5 rounded-xl bg-gray-50 border border-gray-100/30 flex flex-col gap-1 hover:bg-white transition-colors">
                        <span class="text-[8px] font-bold text-gray-400 tracking-tight uppercase">{{ msg.time }}</span>
                        <span class="text-xs text-gray-600 font-medium leading-relaxed">{{ msg.payload }}</span>
                    </div>
                </div>
            </div>
        </transition>
    </div>
</template>

<style scoped>
/* Bounce and Glow animation for the pill */
@keyframes noti-pulse {
    0% {
        transform: translateY(0);
        box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
    }

    30% {
        transform: translateY(-4px);
        box-shadow: 0 0 15px 2px rgba(37, 99, 235, 0.3);
    }

    100% {
        transform: translateY(0);
        box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
    }
}

.noti-pulse {
    animation: noti-pulse 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Pop animation for the count badge */
.pop-enter-active {
    animation: badge-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes badge-pop {
    0% {
        transform: scale(0.5);
        opacity: 0;
    }

    100% {
        transform: scale(1);
        opacity: 1;
    }
}

.expand-enter-active,
.expand-leave-active {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.expand-enter-from,
.expand-leave-to {
    height: 0 !important;
    opacity: 0;
}

.custom-scrollbar::-webkit-scrollbar {
    width: 5px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #e5e7eb;
    border-radius: 10px;
}
</style>
