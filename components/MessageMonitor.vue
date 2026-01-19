<script setup lang="ts">
import { useMqttConnection } from '~/composables/useMqttConnection'

const { is_connected, channel, connectChannel } = useMqttConnection()
const { $mqtt } = useNuxtApp()

const received_messages = ref<{ time: string; payload: string; id: number }[]>([])
const isExpanded = ref(false)
const newMessagePulse = ref(false) // Track animation state
const remoteTopic = ref(useRuntimeConfig().public.mqttRemoteTopic || "")

// Editing State
const isEditing = ref(false)
const localChannel = ref('')
const channelInputRef = ref<HTMLInputElement | null>(null)

const startEditing = (e: Event) => {
    e.stopPropagation() // Prevent toggling dropdown
    localChannel.value = channel.value
    isEditing.value = true
    isExpanded.value = false // Close dropdown if open
    nextTick(() => {
        channelInputRef.value?.focus()
    })
}

const saveChannel = async (e?: Event) => {
    if (e) e.stopPropagation()
    channel.value = localChannel.value
    await connectChannel()
    isEditing.value = false
}

const cancelEditing = (e: Event) => {
    e.stopPropagation()
    isEditing.value = false
}

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
        <div @click="!isEditing && (isExpanded = !isExpanded)" :class="[
            'bg-white rounded-full shadow-lg border border-gray-100 px-4 py-2 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-all select-none h-[42px]',
            { 'noti-pulse': newMessagePulse && !isExpanded }
        ]">

            <!-- Edit Mode -->
            <div v-if="isEditing" class="flex items-center gap-2" @click.stop>
                <input 
                    ref="channelInputRef"
                    v-model="localChannel" 
                    type="number"
                    class="w-24 bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Channel"
                    @keyup.enter="saveChannel"
                    @keyup.esc="cancelEditing"
                    @blur="saveChannel"
                />
                <button @click="saveChannel" class="text-green-600 hover:text-green-700">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
                </button>
            </div>

            <!-- Display Mode -->
            <template v-else>
                <!-- Dot Indicator (No Text) -->
                <div class="flex items-center justify-center">
                     <span class="w-2.5 h-2.5 rounded-full shadow-sm ring-1 ring-white" :class="is_connected ? 'bg-green-500' : 'bg-gray-300'"></span>
                </div>

                <!-- Channel Info -->
                <div class="flex items-center gap-2 group px-1">
                    <div class="flex flex-col items-start leading-none gap-0.5">
                        <span class="text-[9px] uppercase font-extrabold text-gray-400 tracking-wider">Channel</span>
                        <span class="text-base font-black text-gray-800 font-mono tracking-tight">{{ channel || '...' }}</span>
                    </div>
                    
                    <!-- Edit Icon (Visual Cue) -->
                    <button @click="startEditing" class="p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-blue-500 transition-colors">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    </button>
                </div>

                <!-- Message Count Badge -->
                <transition name="pop">
                    <div v-if="received_messages.length > 0" :key="received_messages.length"
                        class="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-sm shadow-blue-200">
                        {{ received_messages.length }}
                    </div>
                </transition>
            </template>
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
