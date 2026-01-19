<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { useMqttConnection } from '~/composables/useMqttConnection';
import { generateLogoCode } from '~/utils/logoGenerator';
import { isSidebarCollapsed, toggleSidebar, notify } from '~/composables/useLayoutState';

const { $mqtt } = useNuxtApp()
const { channel } = useMqttConnection()
const remoteTopic = ref(useRuntimeConfig().public.mqttRemoteTopic || "")
const { webhidConnected, connect, disconnect, isSupported, sendReport } = useWebHID()

const received_messages = ref<{ time: string; payload: string }[]>([])
const show_mqtt_info = ref(false)

const showPassword = ref(false)
const wifiConfig = ref({
    ssid: '',
    password: ''
})

const isWifiExpanded = ref(false)
const isStep3Expanded = ref(false)
const showChannelInfo = ref(false)

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
        channel: String(channel.value || 0),
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
            notify(`Compilation error: ${response.message}`, 'error')
            return
        }
        const byteCodes = response.data
        console.log('Received byte codes from cloud compiler:', byteCodes)

        if (Array.isArray(byteCodes) && byteCodes.length > 0) {
            await sendToDevice(byteCodes)
            notify('Program downloaded successfully', 'success')
        }
    } catch (error) {
        notify('Failed to download program', 'error')
    }
};

const sendWifiConfig = async () => {
    if (!webhidConnected.value) {
        console.log('WebHID not connected, connecting before sending WiFi config...')
        await handleConnect()
        if (!webhidConnected.value) return
    }

    if (!sendReport.value) return

    try {
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

        // 1. Send SSID
        const ssidBytes = new TextEncoder().encode(wifiConfig.value.ssid)
        const ssidCmd = new Uint8Array(64).fill(0)
        ssidCmd[1] = 1  // Category: Memory/Control
        ssidCmd[2] = 10 // Cmd: Set WiFi SSID
        ssidCmd[3] = ssidBytes.length
        ssidBytes.forEach((byte, i) => ssidCmd[4 + i] = byte)
        await sendReport.value(ssidCmd)
        await sleep(50)

        // 2. Send Password
        const passBytes = new TextEncoder().encode(wifiConfig.value.password)
        const passCmd = new Uint8Array(64).fill(0)
        passCmd[1] = 1  // Category: Memory/Control
        passCmd[2] = 11 // Cmd: Set WiFi Password
        passCmd[3] = passBytes.length
        passBytes.forEach((byte, i) => passCmd[4 + i] = byte)
        await sendReport.value(passCmd)
        await sleep(50)

        // 3. Beep to confirm
        const beepCmd = new Uint8Array(64).fill(0)
        beepCmd[1] = 0
        beepCmd[2] = 11
        await sendReport.value(beepCmd)

        notify('WiFi configuration sent! Check the Wifi status on the GoGo Board\'s screen', 'success')
    } catch (error) {
        notify('Failed to send WiFi configuration.', 'error')
    }
};

const isValidNumber = (value: number, min = 0, max = 10000) => {
    return !isNaN(value) && value >= min && value <= max
};

const handleConfigureRobot = async () => {
    // Step 2 Action (Conditional): only if SSID is provided
    if (wifiConfig.value.ssid) {
        await sendWifiConfig()
    }
    
    // Step 3 Action (Always)
    await downloadTemplateProgram()
}

const randomizeChannel = () => {
    // Generate a number between 10000 and 99999
    channel.value = Math.floor(10000 + Math.random() * 90000).toString();
};

const blurInput = (e: Event) => {
    (e.target as HTMLInputElement).blur()
};
</script>

<template>
    <div class="px-5 py-6 flex flex-col h-screen overflow-hidden bg-gray-900 text-gray-100 font-sans">
        <!-- Header -->
        <div class="flex items-center justify-between mb-8 flex-shrink-0 h-9">
            <div class="flex items-center gap-3">
                <div class="p-2 bg-blue-500/20 rounded-xl text-blue-400">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </div>
                <h2 class="text-sm font-black uppercase tracking-widest text-gray-400">Robot Settings</h2>
            </div>
            <button @click="toggleSidebar" class="p-2 hover:bg-white/10 rounded-full text-gray-500 transition-colors">
                <svg v-if="!isSidebarCollapsed" class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="m18.75 4.5-7.5 7.5 7.5 7.5m-6-15L5.25 12l7.5 7.5" />
                </svg>
                <svg v-else class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="m5.25 4.5 7.5 7.5-7.5 7.5m6-15 7.5 7.5-7.5 7.5" />
                </svg>
            </button>
        </div>

        <!-- Scrollable Forms -->
        <div class="flex-1 overflow-y-auto space-y-6 pr-1 min-h-0 custom-scrollbar pb-8">
            <!-- 1. Device Status Card -->
            <div class="bg-gray-800/40 rounded-3xl p-5 border border-white/5 shadow-sm">
                <div class="flex items-center gap-4 mb-4">
                    <span class="text-4xl font-black opacity-50 select-none leading-none" 
                        :class="webhidConnected ? 'text-green-500' : 'text-red-500'">1</span>
                    <div class="flex items-center gap-3">
                        <div class="size-2 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]" :class="webhidConnected ? 'bg-green-400' : 'bg-red-400'"></div>
                        <span class="text-xs font-bold uppercase tracking-widest text-gray-300">Robot Connection</span>
                    </div>
                </div>
                
                <p class="text-[11px] text-gray-400 mb-3 leading-relaxed">
                    Start by connecting your robot to the computer via <span class="text-white font-bold">USB Cable</span>.
                </p>

                <button @click="handleConnect"
                    class="w-full py-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all duration-300"
                    :class="[webhidConnected ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-white text-gray-900 hover:scale-[1.02] active:scale-95 shadow-lg']">
                    {{ webhidConnected ? 'Robot Connected' : 'Connect to Robot' }}
                </button>
            </div>

            <!-- 2. WiFi Card -->
            <div class="bg-gray-800/40 rounded-3xl overflow-hidden border border-white/5 transition-all duration-300"
                :class="isWifiExpanded ? 'bg-gray-800/60 ring-1 ring-blue-500/20' : 'hover:bg-gray-800/60'">
                <div @click="isWifiExpanded = !isWifiExpanded" 
                    class="p-5 flex items-center justify-between cursor-pointer group select-none">
                    <div class="flex items-center gap-4">
                        <span class="text-4xl font-black text-blue-500/50 select-none leading-none">2</span>
                        <span class="text-xs font-bold uppercase tracking-widest text-gray-300">
                            WiFi connection <span class="text-gray-500 normal-case tracking-normal ml-1">(Optional)</span>
                        </span>
                    </div>
                    <svg class="w-4 h-4 text-gray-500 transition-transform duration-300" 
                        :class="isWifiExpanded ? 'rotate-180 text-blue-400' : ''"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>

                <transition name="slide">
                    <div v-if="isWifiExpanded" class="px-5 pb-5 space-y-5">
                        <div class="space-y-2">
                            <label class="text-[10px] font-bold text-gray-500 uppercase ml-1">WiFi Name</label>
                            <input v-model="wifiConfig.ssid" type="text" placeholder="SSID"
                                class="w-full px-4 py-3 bg-gray-900/50 rounded-xl border border-white/5 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all text-sm font-semibold" />
                        </div>

                        <div class="space-y-2">
                            <label class="text-[10px] font-bold text-gray-500 uppercase ml-1">Password</label>
                            <div class="relative">
                                <input :type="showPassword ? 'text' : 'password'" v-model="wifiConfig.password" placeholder="••••••••"
                                    class="w-full px-4 py-3 bg-gray-900/50 rounded-xl border border-white/5 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all text-sm font-semibold" />
                                <button @click="showPassword = !showPassword" class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-blue-400 transition-colors">
                                    <svg v-if="showPassword" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                                    <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                </button>
                            </div>
                        </div>

                        <div class="space-y-2">
                            <div class="flex items-center gap-1">
                                <label class="text-[10px] font-bold text-gray-500 uppercase ml-1">Your Channel Number</label>
                                <button @click="showChannelInfo = !showChannelInfo" class="text-gray-500 hover:text-blue-400 transition-colors">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </button>
                            </div>
                            <div class="flex gap-2">
                                <input v-model="channel" type="number" placeholder="Pick a number" @wheel="blurInput"
                                    class="w-full px-4 py-3 bg-gray-900/50 rounded-xl border border-white/5 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all text-sm font-semibold no-spinner" />
                                <button @click="randomizeChannel" 
                                    class="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-gray-300 font-bold text-xs uppercase tracking-wider transition-colors">
                                    Randomize
                                </button>
                            </div>
                            <!-- Tip Message -->
                            <transition name="fade">
                                <p v-if="showChannelInfo" class="text-xs text-blue-300 bg-blue-500/10 p-2 rounded-lg border border-blue-500/20">
                                    Use this number to send and receive block code on the right panel. Don’t forget it.
                                </p>
                            </transition>
                        </div>
                    </div>
                </transition>
            </div>

            <!-- 3. Template Selection Card -->
            <div class="bg-gray-800/40 rounded-3xl overflow-hidden border border-white/5 transition-all duration-300"
                :class="isStep3Expanded ? 'bg-gray-800/60 ring-1 ring-orange-500/20' : 'hover:bg-gray-800/60'">
                <div @click="isStep3Expanded = !isStep3Expanded"
                    class="p-5 flex items-center justify-between cursor-pointer group select-none">
                    <div class="flex items-center gap-4">
                        <span class="text-4xl font-black text-orange-500/50 select-none leading-none">3</span>
                        <span class="text-xs font-bold uppercase tracking-widest text-gray-300">Settings</span>
                    </div>
                    <svg class="w-4 h-4 text-gray-500 transition-transform duration-300"
                        :class="isStep3Expanded ? 'rotate-180 text-orange-400' : ''"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>

                <div class="px-5 pb-5 space-y-5">
                    <transition name="slide">
                        <div v-if="isStep3Expanded" class="space-y-4">
                            <p class="text-[10px] text-gray-500 italic">Times are in milliseconds</p>
                            
                            <div class="space-y-2">
                                <label class="text-[10px] font-bold text-gray-500 uppercase ml-1">Pause time between commands</label>
                                <input v-model.number="programConfig.playbackWait" type="number" @wheel="blurInput"
                                    class="w-full px-4 py-3 bg-gray-900/50 rounded-xl border border-white/5 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 outline-none transition-all text-sm font-semibold no-spinner" />
                            </div>

                            <div class="space-y-2">
                                <label class="text-[10px] font-bold text-gray-500 uppercase ml-1">Turn duration</label>
                                <input v-model.number="programConfig.turnWait" type="number" @wheel="blurInput"
                                    class="w-full px-4 py-3 bg-gray-900/50 rounded-xl border border-white/5 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 outline-none transition-all text-sm font-semibold no-spinner" />
                            </div>

                            <div class="space-y-2">
                                <label class="text-[10px] font-bold text-gray-500 uppercase ml-1">Move duration</label>
                                <input v-model.number="programConfig.moveWait" type="number" @wheel="blurInput"
                                    class="w-full px-4 py-3 bg-gray-900/50 rounded-xl border border-white/5 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 outline-none transition-all text-sm font-semibold no-spinner" />
                            </div>
                        </div>
                    </transition>
                </div>
            </div>

            <!-- Configure Robot Button (Moved outside Step 3) -->
            <button @click="handleConfigureRobot"
                :disabled="!webhidConnected"
                class="w-full py-4 rounded-2xl bg-orange-500 text-white font-bold text-xs uppercase tracking-widest hover:bg-orange-600 transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-lg shadow-orange-900/20 active:scale-95">
                {{ webhidConnected ? 'Configure Robot' : 'Connect Robot First' }}
            </button>
            
            <!-- MQTT Info Button -->
            <button @click="show_mqtt_info = true"
                class="w-full flex items-center justify-center gap-2 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-widest hover:text-gray-400 transition-colors">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Help & MQTT Details
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
    </div>
</template>

<style scoped>
/* Hide scroll-to-change and numeric spinners */
.no-spinner::-webkit-inner-spin-button,
.no-spinner::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

.no-spinner {
    -moz-appearance: textfield;
}

.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #374151;
    border-radius: 10px;
}

.slide-enter-active,
.slide-leave-active {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
    opacity: 0;
    height: 0 !important;
    transform: translateY(10px);
}

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
