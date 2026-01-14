<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { useMqttConnection } from '~/composables/useMqttConnection';
import { generateLogoCode } from '~/utils/logoGenerator';

const { $mqtt } = useNuxtApp()
const { channel, is_connected } = useMqttConnection()
const remoteTopic = ref(useRuntimeConfig().public.mqttRemoteTopic || "")
const { webhidConnected, connect, disconnect, isSupported, sendReport, notification } = useWebHID()

const received_messages = ref<{ time: string; payload: string }[]>([])
const show_messages = ref(true)
const show_mqtt_info = ref(false)

const programConfig = ref({
    playbackWait: 500, // milliseconds
    turnWait: 200,    // milliseconds  
    moveWait: 300     // milliseconds
})

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

const generateProgramSettings = () => {
    return {
        channel: channel.value,
        playbackWait: programConfig.value.playbackWait,
        turnWait: programConfig.value.turnWait,
        moveWait: programConfig.value.moveWait,
        // timestamp: new Date().toISOString()
    }
}

const handleConnect = async () => {
    if (!isSupported()) {
        console.error('WebHID not supported')
        return
    }

    try {
        await connect()
    } catch (error) {
        console.error('Connection failed:', error)
    }
}

const compileLogoProgram = async (logoCode: string) => {
    const body = new URLSearchParams()
    body.append('logo', logoCode)
    body.append('firmware_version', '2')
    body.append('board_type', '6') // GoGo 7
    body.append('board_version', '125') // GoGo Board 7E

    return await $fetch('https://public-api.gogoboard.org/logo/dev/compile', {
        method: 'POST',
        body: body,
    })
}

const sendToDevice = async (byteCodes: number[]) => {
    if (!sendReport.value) return

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    // 1. Set memory pointer to 0
    const pointerCmd = new Uint8Array(64).fill(0)
    pointerCmd[1] = 1 // CATEGORY_MEMORY_CONTROL
    pointerCmd[2] = 1 // MEM_LOGO_SET_POINTER
    pointerCmd[3] = 0 // PARAMETER1
    pointerCmd[4] = 0 // PARAMETER2

    await sendReport.value(pointerCmd)
    await sleep(20)

    // 2. Write bytecodes in chunks
    const CHUNK_SIZE = 60 // TX_PACKET_SIZE (64) - 4 header bytes
    for (let offset = 0; offset < byteCodes.length; offset += CHUNK_SIZE) {
        const chunk = byteCodes.slice(offset, offset + CHUNK_SIZE)
        const writeCmd = new Uint8Array(64).fill(0)

        writeCmd[1] = 1            // CATEGORY_MEMORY_CONTROL
        writeCmd[2] = 3            // MEM_WRITE
        writeCmd[3] = chunk.length // Data length

        chunk.forEach((byte, i) => {
            writeCmd[4 + i] = byte
        })

        await sendReport.value(writeCmd)
        // Delay allows the processor to finish writing to flash
        await sleep(20)
    }

    // 3. Send beep command [0, 0, 11] as confirmation
    const beepCmd = new Uint8Array(64).fill(0)
    beepCmd[1] = 0  // CATEGORY_SYSTEM (assumed)
    beepCmd[2] = 11 // CMD_BEEP

    await sendReport.value(beepCmd)
    await sleep(20)

    // 4. Send run program command [0, 0, 13, 1] to start execution
    const runCmd = new Uint8Array(64).fill(0)
    runCmd[1] = 0  // CATEGORY_SYSTEM (assumed)
    runCmd[2] = 13 // CMD_RUN_LOGO_PROGRAM
    runCmd[3] = 1 // PARAMETER1, 0: stop, 1: run, 2:toggle

    await sendReport.value(runCmd)
}

const downloadTemplateProgram = async () => {
    console.log('Downloading template program..., connected:', webhidConnected.value)
    if (!webhidConnected.value) {
        await handleConnect()
        if (!webhidConnected.value) return
    }

    try {
        // Generate program template with current settings
        const logoProgram = generateLogoCode(generateProgramSettings())
        console.log(logoProgram)

        const response: any = await compileLogoProgram(logoProgram)
        if (response && response.result === false) {
            console.error('Compilation error:', response.message)
            return
        }
        const byteCodes = response.data
        console.log('Received byte codes from cloud compiler:', byteCodes)

        if (Array.isArray(byteCodes) && byteCodes.length > 0) {
            await sendToDevice(byteCodes)
            console.log('Program downloaded successfully')
        }
    } catch (error) {
        console.error('Failed to download program:', error)
    }
}

const clearMessages = () => {
    received_messages.value = []
};

const toggleMessages = () => {
    show_messages.value = !show_messages.value
};

const isValidNumber = (value: number, min = 0, max = 10000) => {
    return !isNaN(value) && value >= min && value <= max
}
</script>

<template>
    <div class="p-4 flex flex-col" style="height: 100vh;">
        <div class="flex-shrink-0">
            <h2 class="text-xl font-bold mb-6">Settings</h2>

            <div class="flex items-center justify-between mb-1">
                <label class="text-base font-medium">Template Program Setup</label>
            </div>
            <!-- Configuration Form -->
            <div class="bg-gray-50 rounded-lg p-4 mb-4 space-y-4">
                <!-- Channel Input -->
                <div class="flex flex-col">
                    <label class="text-sm font-medium text-gray-700 mb-1">Channel</label>
                    <input v-model.number="channel" type="number" placeholder="Enter channel number"
                        class="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        :class="{ 'border-red-300 focus:ring-red-500': !channel }" />
                    <span v-if="!channel" class="text-xs text-red-500 mt-1">Channel is required</span>
                </div>

                <!-- Playback Wait -->
                <div class="flex flex-col">
                    <label class="text-sm font-medium text-gray-700 mb-1">
                        Playback Wait
                        <span class="text-gray-500 font-normal">(ms)</span>
                    </label>
                    <input v-model.number="programConfig.playbackWait" type="number" min="0" max="10000"
                        placeholder="500"
                        class="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        :class="{ 'border-red-300 focus:ring-red-500': !isValidNumber(programConfig.playbackWait) }" />
                    <span class="text-xs text-gray-500 mt-1">Wait time between commands during playback</span>
                </div>

                <!-- Turn Wait -->
                <div class="flex flex-col">
                    <label class="text-sm font-medium text-gray-700 mb-1">
                        Turn Wait
                        <span class="text-gray-500 font-normal">(ms)</span>
                    </label>
                    <input v-model.number="programConfig.turnWait" type="number" min="0" max="10000" placeholder="1000"
                        class="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        :class="{ 'border-red-300 focus:ring-red-500': !isValidNumber(programConfig.turnWait) }" />
                    <span class="text-xs text-gray-500 mt-1">Duration for left/right turn commands</span>
                </div>

                <!-- Move Wait -->
                <div class="flex flex-col">
                    <label class="text-sm font-medium text-gray-700 mb-1">
                        Move Wait
                        <span class="text-gray-500 font-normal">(ms)</span>
                    </label>
                    <input v-model.number="programConfig.moveWait" type="number" min="0" max="10000" placeholder="1000"
                        class="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        :class="{ 'border-red-300 focus:ring-red-500': !isValidNumber(programConfig.moveWait) }" />
                    <span class="text-xs text-gray-500 mt-1">Duration for forward/backward movement commands</span>
                </div>
            </div>

            <button @click="downloadTemplateProgram"
                :disabled="!channel || !isValidNumber(programConfig.playbackWait) || !isValidNumber(programConfig.turnWait) || !isValidNumber(programConfig.moveWait)"
                class='px-4 py-2 mb-2 rounded font-medium transition' :class="[
                    !channel || !isValidNumber(programConfig.playbackWait) || !isValidNumber(programConfig.turnWait) || !isValidNumber(programConfig.moveWait)
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                ]">
                Download Template
            </button>
        </div>

        <!-- Message Monitor - Bottom Layout -->
        <div class="mt-auto">
            <div>
                <div class="flex items-center justify-between pt-2 mb-2 cursor-pointer min-w-0" @click="toggleMessages">
                    <h3 class="text-base font-medium flex items-center gap-2 min-w-0 overflow-hidden">
                        <span :class="[
                            'inline-block w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-200',
                            is_connected ? 'bg-green-400' : 'bg-red-400'
                        ]"></span>
                        <span class="truncate">Message Monitor</span>
                        <span class="text-xs text-gray-500 font-normal truncate">({{ received_messages.length }}
                            messages)</span>
                    </h3>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        <button @click.stop="clearMessages" class="text-xs text-blue-400 hover:underline">
                            Clear
                        </button>
                    </div>
                </div>

                <transition name="slide">
                    <div v-show="show_messages" class="bg-gray-800 rounded-lg p-3 text-sm max-h-78 overflow-hidden">
                        <div class="overflow-y-auto max-h-64">
                            <p v-if="!received_messages.length" class="text-gray-400 text-center py-4">No messages
                                received
                            </p>
                            <div v-else class="space-y-2">
                                <div v-for="(msg, index) in [...received_messages].reverse().slice(0, 10)" :key="index"
                                    class="flex items-start gap-3 px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors duration-150">
                                    <div class="text-xs text-gray-400 font-mono min-w-fit">
                                        {{ msg.time }}
                                    </div>
                                    <div class="text-sm text-white font-mono break-all flex-1">
                                        {{ msg.payload }}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div v-if="received_messages.length > 10"
                            class="text-xs text-gray-400 text-center mt-2 pt-2 border-t border-gray-600">
                            Showing latest 10 of {{ received_messages.length }} messages
                        </div>
                    </div>
                </transition>
            </div>

            <div class="mt-2">
                <button @click="show_mqtt_info = true"
                    class="w-full text-center text-xs text-gray-500 hover:text-gray-700 transition-colors duration-150">
                    <div class="flex items-center justify-center gap-1">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        MQTT Configuration Info
                    </div>
                </button>
            </div>
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
                            <li>
                                <span class="text-gray-400">Control topic: </span>
                                <span class="text-white">gogo-pgc/control/&lt;channel&gt;</span>
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

        <!-- Notification Toast -->
        <transition name="fade">
            <div v-if="notification"
                class="fixed bottom-4 right-4 z-50 px-6 py-3 rounded-lg shadow-xl text-white font-medium flex items-center gap-3"
                :class="{
                    'bg-green-600': notification.type === 'success',
                    'bg-blue-600': notification.type === 'info',
                    'bg-red-600': notification.type === 'error'
                }">
                <svg v-if="notification.type === 'success'" class="w-5 h-5" fill="none" stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>{{ notification.message }}</span>
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

.slide-enter-active,
.slide-leave-active {
    transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
    opacity: 0;
    max-height: 0;
    transform: translateY(-10px);
}
</style>
