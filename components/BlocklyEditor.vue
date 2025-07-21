<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { useChannel } from '~/composables/useChannel';
import { isSidebarCollapsed } from '~/composables/useLayoutState';

import * as Blockly from "blockly/core";
import * as En from "blockly/msg/en";
import * as libraryBlocks from 'blockly/blocks';

import initBlocks from '~/blockly/blocks/gogo-block';
import initGenerator from '~/blockly/generators/gogo-generator'
import customCategory from '~/blockly/custom-category'
import xmlToolbox from '~/blockly/gogo-toolbox'

const { $mqtt } = useNuxtApp(); // Get Blockly & MQTT from Nuxt plugin
const { channel } = useChannel()
const remoteTopic = ref(useRuntimeConfig().public.mqttRemoteTopic || "");
const blocklyTopic = ref(useRuntimeConfig().public.mqttBlocklyTopic || "");
const controlTopic = ref(useRuntimeConfig().public.mqttControlTopic || "");
let onMessageHandler; // Store the event handler reference

const trackWait = ref(false);
const fallbackWaitTime = ref(500);

const generatedCode = ref('');
let workspace = Blockly.WorkspaceSvg;
let gogoGenerator = null;

let lastReceivedTime = 0;
let lastActiveBlock = null; // Track the last block used (from MQTT or user)

class BiMap {
    constructor(entries) {
        this.forward = new Map(entries);
        this.reverse = new Map(entries.map(([k, v]) => [v, k]));
    }
    get(key) { return this.forward.get(key); }
    getReverse(value) { return this.reverse.get(value); }
}

const commandMapping = new BiMap([
    ['F', 'up'],
    ['B', 'down'],
    ['L', 'left'],
    ['R', 'right'],
    ['S', 'stop']
]);

onMounted(() => {
    customCategory(Blockly)
    initBlocks(Blockly)
    gogoGenerator = initGenerator(Blockly)
    Blockly.setLocale(En);

    workspace = Blockly.inject('blocklyDiv', {
        toolbox: xmlToolbox,
        theme: 'modern',
        renderer: 'zelos',
        theme: Blockly.Theme.defineTheme('modern', {
            base: Blockly.Themes.Zelos,
            blockStyles: {
                'basic_blocks': {
                    'colourPrimary': '#F4C95D',
                    'colourSecondary': '#FFE082',
                    'colourTertiary': '#D6A84E',
                },
                'movement_blocks': {
                    'colourPrimary': '#2965CC',
                    'colourSecondary': '#66A3FF',
                    'colourTertiary': '#1A3F7A',
                },
                'time_blocks': {
                    'colourPrimary': '#F4A261',
                    'colourSecondary': '#FFE0B2',
                    'colourTertiary': '#E76F51',
                },
            },
            categoryStyles: {
                'movement_category': {
                    'colour': '#2965CC'
                },
                'time_category': {
                    'colour': '#F4A261'
                }
            },
            componentStyles: {
                workspaceBackgroundColour: '#f8f9fa',
                toolboxBackgroundColour: '#ffffff',
                toolboxForegroundColour: '#000000',
                flyoutBackgroundColour: '#ffffff',
                flyoutOpacity: 1,
                scrollbarColour: '#cccccc',
                scrollbarOpacity: 0.8,
            },
        }),
        zoom: {
            controls: true, // Enable zoom in/out buttons
            wheel: true,    // Optional: enable mouse wheel zoom
            startScale: 1,
            maxScale: 2,
            minScale: 0.3,
            scaleSpeed: 1.2
        }
    });

    initWorkspace()

    // Track user-added blocks
    workspace.addChangeListener((event) => {
        // BLOCK_CREATE — track single new block
        if (event.type === Blockly.Events.BLOCK_CREATE && event.ids.length === 1) {
            const newBlock = workspace.getBlockById(event.ids[0]);
            if (newBlock && !newBlock.isShadow()) {
                lastActiveBlock = newBlock;
            }
        }

        // BLOCK_MOVE — track when a block is moved
        if (event.type === Blockly.Events.BLOCK_MOVE) {
            const movedBlock = workspace.getBlockById(event.blockId);
            if (movedBlock && !movedBlock.isShadow()) {
                lastActiveBlock = movedBlock;
            }
        }

        // BLOCK_SELECT — track when a block is clicked/selected
        if (event.type === Blockly.Events.SELECTED && event.newElementId) {
            const selectedBlock = workspace.getBlockById(event.newElementId);
            if (selectedBlock && !selectedBlock.isShadow()) {
                lastActiveBlock = selectedBlock;
            }
        }

        // BLOCK_DELETE — handle when last active block is deleted
        if (event.type === Blockly.Events.BLOCK_DELETE) {
            if (lastActiveBlock && event.ids.includes(lastActiveBlock.id)) {
                const remainingBlocks = workspace.getAllBlocks(false);
                lastActiveBlock = remainingBlocks.length > 0 ? remainingBlocks[remainingBlocks.length - 1] : null;
            }
        }

        generatedCode.value = gogoGenerator.workspaceToCode(workspace).trim();
    });

    window.addEventListener('resize', () => Blockly.svgResize(workspace));

    // Avoid duplicate event listeners
    if (onMessageHandler) {
        $mqtt.removeListener("message", onMessageHandler);
    }

    // Define the MQTT message handler
    onMessageHandler = (topic, message) => {
        let checkingTopic = remoteTopic.value + channel.value
        if (!topic.startsWith(checkingTopic)) return;

        const time = Date.now();
        const commandPacket = message.toString().trim(); // Convert to string and trim
        console.log(`📩 ${time} - On channel: ${channel.value} received: ${commandPacket}`);


        // INFO: clear lastActiveBlock to disconnected the code block of different command group
        lastActiveBlock = null
        for (const command of resolveCommandPacket(commandPacket)) {
            createBlockFromCommand(command);
        }
    };

    // Attach the event listener
    $mqtt.on("message", onMessageHandler);
});

onBeforeUnmount(() => {
    if ($mqtt) {
        $mqtt.removeListener("message", onMessageHandler); // Remove listener
    }
});

watch(isSidebarCollapsed, () => {
    setTimeout(() => {
        Blockly.svgResize(workspace);
    }, 250);
});

const resolveCommandPacket = (packet) => {
    return Array.from(packet).map(command => commandMapping.get(command))
};

const constructCommandPacket = (commands) => {
    return commands.map(command => commandMapping.getReverse(command)).join('');
};

const createBlockFromCommand = (command) => {
    // split command into parts - first word is the command, rest are arguments
    const commandParts = command.trim().split(' ')
    const commandName = commandParts[0]
    const commandArgs = commandParts.slice(1)

    const blockMapping = {
        up: "movement_forward",
        down: "movement_backward",
        left: "movement_left",
        right: "movement_right",
        stop: "movement_stop",
        wait: "time_wait_ms",
    };
    const getInputNameForBlockType = (blockType) => {
        switch (blockType) {
            case "movement_forward":
            case "movement_backward":
                return "STEPS";
            case "movement_left":
            case "movement_right":
                return "DEGREES";
            case "time_wait_ms":
                return "TIME";
            default:
                return null;
        }
    };

    const blockType = blockMapping[commandName];
    if (!blockType) {
        console.warn(`No matching block for command: ${commandName}`);
        return;
    }

    const newBlock = workspace.newBlock(blockType);

    // Handle arguments if they exist, only handles number argument
    if (commandArgs.length > 0 && !isNaN(parseFloat(commandArgs[0]))) {
        const inputName = getInputNameForBlockType(blockType);
        if (inputName && newBlock.getInput(inputName)) {
            // Create a shadow math_number block
            const shadowBlock = workspace.newBlock('math_number');
            shadowBlock.setFieldValue(commandArgs[0], 'NUM');
            shadowBlock.initSvg();

            // Connect as shadow block
            const connection = newBlock.getInput(inputName).connection;
            connection.connect(shadowBlock.outputConnection);
            shadowBlock.setShadow(true);
        }
    }

    newBlock.initSvg();
    newBlock.render();

    // if there's a last active block, connect this one to it
    if (lastActiveBlock && lastActiveBlock.nextConnection && newBlock.previousConnection) {
        lastActiveBlock.nextConnection.connect(newBlock.previousConnection);
    }

    // Update lastActiveBlock to this new MQTT-created block
    lastActiveBlock = newBlock;
};

const initWorkspace = () => {
    let xmlWorkspace = Blockly.utils.xml.textToDom(`<xml><block type="main_start"></block></xml>`)
    Blockly.Xml.domToWorkspace(xmlWorkspace, workspace)
    workspace.scrollCenter()
}

const clearBlocks = () => {
    workspace.clear()
    initWorkspace()

    lastReceivedTime = 0
};

const controlDownload = () => {
    if (!$mqtt) return;

    if (channel.value === "") {
        console.log("⚠️ Channel is empty.");
        return;
    }
    // console.log(`👀 Generated code\n\n${generatedCode.value}`);

    const codeLines = generatedCode.value.trim().split("\n");
    const commands = [];
    let inStartBlock = false;

    for (const line of codeLines) {
        const trimmed = line.trim().toLowerCase();

        if (trimmed === "start") {
            inStartBlock = true;
            continue;
        }

        if (trimmed === "end") {
            inStartBlock = false;
            break;
        }

        if (inStartBlock) {
            commands.push(line.trim());
        }
    }
    if (commands.length == 0) {
        console.log("⚠️ Commands is empty.");
        return;
    }

    const commandPacket = constructCommandPacket(commands)
    // console.log(`👀 Generated packet\n\n${commandPacket}`);

    const topic = blocklyTopic.value + channel.value;
    $mqtt.publish(topic, commandPacket);
    console.log(`📩 [${channel.value}] sent: ${commandPacket}`);
};

const controlRun = () => {
    const topic = controlTopic.value + channel.value;
    $mqtt.publish(topic, 'run');
    console.log(`📩 [${channel.value}] sent: control run`);
};

const clampFallbackWait = () => {
    if (fallbackWaitTime.value < 500) fallbackWaitTime.value = 500
};
</script>

<template>
    <div class="h-screen bg-gray-100 flex flex-col">
        <!-- Header -->
        <header class="px-6 py-3 bg-white border-b border-gray-200 shadow-sm flex justify-between items-center">
            <h1 class="text-2xl font-semibold text-gray-800">GoGo Programming Continuum</h1>

            <div class="absolute top-20 right-8 flex gap-4 bg-white rounded-full shadow-lg px-4 py-2 items-center z-10">
                <button @click="clearBlocks"
                    class="flex items-center gap-2 text-sm font-medium hover:text-gray-800 text-gray-500 transition-colors duration-150"
                    aria-label="Stop" title="Clear Blocks">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                        stroke="currentColor" class="size-5">
                        <path stroke-linecap="round" stroke-linejoin="round"
                            d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m6 4.125 2.25 2.25m0 0 2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                    </svg>
                    Clear Blocks
                </button>
            </div>
        </header>

        <!-- Blockly Workspace -->
        <div class="flex-1 relative">
            <div id="blocklyDiv" class="absolute inset-0"></div>
        </div>

        <!-- Footer / Control Panel -->
        <footer class="w-full px-6 py-5 bg-white border-t border-gray-200 shadow-inner flex items-center relative">
            <!-- <div class="flex items-center gap-2"> -->
            <!--     <span class="text-sm text-gray-700">Capture wait time</span> -->
            <!--     <button @click="trackWait = !trackWait" type="button" :aria-pressed="trackWait" -->
            <!--         class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none" -->
            <!--         :class="trackWait ? 'bg-blue-600' : 'bg-gray-300'"> -->
            <!--         <span -->
            <!--             class="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200" -->
            <!--             :class="trackWait ? 'translate-x-5' : 'translate-x-1'" /> -->
            <!--     </button> -->
            <!--     <span class="text-xs text-gray-500 font-mono w-8 text-center">{{ trackWait ? 'ON' : 'OFF' }}</span> -->
            <!-- </div> -->

            <!-- <div class="absolute left-1/2 transform -translate-x-1/2"> -->
            <!--     <button @click="controlRecording" :class="[ -->
            <!--         'flex items-center gap-2 px-6 py-2 rounded-full font-semibold shadow transition-colors duration-150 focus:outline-none', -->
            <!--         isRecording ? 'bg-gray-700 text-white hover:bg-gray-800' : 'bg-red-600 text-white hover:bg-red-700' -->
            <!--     ]"> -->
            <!--         <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="white" viewBox="0 0 24 24"> -->
            <!--             <circle v-if="!isRecording" cx="12" cy="12" r="10" /> -->
            <!--             <rect v-else x="6" y="6" width="12" height="12" rx="2" /> -->
            <!--         </svg> -->
            <!--         <span class="inline-block text-center w-24"> -->
            <!--             {{ isRecording ? 'Stop Record' : 'Record' }} -->
            <!--         </span> -->
            <!--     </button> -->
            <!-- </div> -->

            <!-- <div class="flex items-center gap-2 ml-auto"> -->
            <!--     <span class="text-sm text-gray-700">Default wait</span> -->
            <!--     <input type="number" min=500 v-model.number="fallbackWaitTime" placeholder="ms" -->
            <!--         @blur="clampFallbackWait" -->
            <!--         class="w-22 px-3 py-2 rounded-full border border-gray-200 bg-gray-50 text-right text-sm shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200 transition" /> -->
            <!--     <span class="text-xs text-gray-500 font-mono">ms</span> -->
            <!-- </div> -->
            <div class="flex items-center gap-2 ml-auto">
                <button @click="controlRun"
                    class='flex items-center size-12 justify-center rounded-full transition bg-green-400 hover:bg-green-600'>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 24 24" stroke-width="2"
                        stroke="white" class="size-6">
                        <path stroke-linecap="round" stroke-linejoin="round"
                            d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                    </svg>
                </button>
                <button @click="controlDownload"
                    class='flex items-center gap-3 px-6 py-3 text-lg rounded-full font-medium transition bg-red-600 text-white hover:bg-red-700'>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2"
                        stroke="currentColor" class="size-6">
                        <path stroke-linecap="round" stroke-linejoin="round"
                            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    {{ 'Download' }}
                </button>
            </div>
        </footer>
    </div>
</template>

<style>
.blocklyMainBackground {
    stroke-width: 0;
}

.blocklyFlyout {
    overflow: hidden !important;
}

.blocklyFlyoutScrollbar {
    display: none !important;
}

/* Makes our label white. */
.blocklyTreeLabel {
    color: white;
}

/* Adds padding around the group of categories and separators. */
.blocklyToolboxContents {
    padding: 0.5em;
}

/* Adds space between the categories, rounds the corners and adds space around the label. */
.blocklyTreeRow {
    padding: 0.8em 16px;
    margin-bottom: 0.5em;
    border-radius: 4px;
    border-width: thin;
}

/* Stacks the icon on top of the label. */
.blocklyTreeRowContentContainer {
    display: flex;
    align-items: center;
}

.blocklyTreeRow {
    height: initial;
}
</style>
