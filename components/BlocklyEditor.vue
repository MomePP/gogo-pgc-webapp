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
const is_connected = ref(false)
let onMessageHandler; // Store the event handler reference

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
    workspace.scrollCenter()

    // Track user-added blocks
    workspace.addChangeListener((event) => {
        // BLOCK_CREATE — track single new block
        // if (event.type === Blockly.Events.BLOCK_CREATE && event.ids.length === 1) {
        //     const newBlock = workspace.getBlockById(event.ids[0]);
        //     if (newBlock && !newBlock.isShadow()) {
        //         lastActiveBlock = newBlock;
        //     }
        // }

        // BLOCK_MOVE — track when a block is moved
        // if (event.type === Blockly.Events.BLOCK_MOVE) {
        //     const movedBlock = workspace.getBlockById(event.blockId);
        //     if (movedBlock && !movedBlock.isShadow()) {
        //         lastActiveBlock = movedBlock;
        //     }
        // }

        // BLOCK_SELECT — track when a block is clicked/selected
        // if (event.type === Blockly.Events.SELECTED && event.newElementId) {
        //     const selectedBlock = workspace.getBlockById(event.newElementId);
        //     if (selectedBlock && !selectedBlock.isShadow()) {
        //         lastActiveBlock = selectedBlock;
        //     }
        // }

        // BLOCK_DELETE — handle when last active block is deleted
        // if (event.type === Blockly.Events.BLOCK_DELETE) {
        //     if (lastActiveBlock && event.ids.includes(lastActiveBlock.id)) {
        //         const remainingBlocks = workspace.getAllBlocks(false);
        //         lastActiveBlock = remainingBlocks.length > 0 ? remainingBlocks[remainingBlocks.length - 1] : null;
        //     }
        // }

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


        // Clear all existing blocks and reinitialize workspace
        clearBlocks();

        // Find the main_start block and set it as lastActiveBlock
        const allBlocks = workspace.getAllBlocks();
        const mainStartBlock = allBlocks.find(block => block.type === 'main_start');
        lastActiveBlock = mainStartBlock || null;

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
        }
    })
};

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

    // handle arguments if they exist, only handles number argument
    if (commandArgs.length > 0 && !isNaN(parseFloat(commandArgs[0]))) {
        const inputName = getInputNameForBlockType(blockType);
        if (inputName && newBlock.getInput(inputName)) {
            // create a shadow math_number block
            const shadowBlock = workspace.newBlock('math_number');
            shadowBlock.setFieldValue(commandArgs[0], 'NUM');
            shadowBlock.initSvg();

            // connect as shadow block
            const connection = newBlock.getInput(inputName).connection;
            connection.connect(shadowBlock.outputConnection);
            shadowBlock.setShadow(true);
        }
    }

    newBlock.initSvg();
    newBlock.render();

    // connect to the appropriate location
    if (lastActiveBlock) {
        if (lastActiveBlock.type === 'main_start') {
            // connect to the statement input of main_start
            const statementInput = lastActiveBlock.getInput('statement');
            if (statementInput && statementInput.connection && newBlock.previousConnection) {
                statementInput.connection.connect(newBlock.previousConnection);
            }
        } else if (lastActiveBlock.nextConnection && newBlock.previousConnection) {
            // connect to the next connection of the previous block
            lastActiveBlock.nextConnection.connect(newBlock.previousConnection);
        }
    }

    // Update lastActiveBlock to this new MQTT-created block
    lastActiveBlock = newBlock;
};

const initWorkspace = () => {
    let xmlWorkspace = Blockly.utils.xml.textToDom(`<xml><block type="main_start"></block></xml>`)
    Blockly.Xml.domToWorkspace(xmlWorkspace, workspace)
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
</script>

<template>
    <div class="h-screen bg-gray-100 flex flex-col">
        <!-- Header -->
        <header class="px-6 py-3 bg-white border-b border-gray-200 shadow-sm flex justify-between items-center">
            <h1 class="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent tracking-wide">GoGo Programming Continuum</h1>

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
            <div class="flex items-center gap-4">
                <div class="flex items-center gap-2">
                    <label class="text-base font-medium text-gray-700">Channel:</label>
                    <input v-model="channel" placeholder="Enter channel"
                        class="w-36 px-4 py-2 text-base font-medium border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-gray-100 transition-colors duration-150" />
                </div>
                <button @click="connectChannel" :disabled="is_connected" :class="[
                    'w-36 px-4 py-2 text-base font-medium rounded-full transition-colors duration-150',
                    is_connected
                        ? 'bg-green-100 text-green-700 border border-green-300 cursor-not-allowed'
                        : 'bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
                ]">
                    {{ is_connected ? '✅ Connected' : 'Connect' }}
                </button>
            </div>
            <div class="flex items-center gap-2 ml-auto">
                <button @click="controlRun"
                    class='flex items-center size-10 justify-center rounded-full transition-colors duration-150 bg-green-100 text-green-700 border border-green-300 hover:bg-green-200 hover:border-green-400'>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" stroke-width="2"
                        stroke="currentColor" class="size-5">
                        <path stroke-linecap="round" stroke-linejoin="round"
                            d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                    </svg>
                </button>
                <button @click="controlDownload"
                    class='flex items-center gap-2 px-4 py-2 text-base font-medium rounded-full transition-colors duration-150 bg-red-100 text-red-700 border border-red-300 hover:bg-red-200 hover:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500'>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2"
                        stroke="currentColor" class="size-5">
                        <path stroke-linecap="round" stroke-linejoin="round"
                            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download
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

/* Wiggle animation */
@keyframes wiggle {
  0%, 7% { transform: rotateZ(0deg); }
  15% { transform: rotateZ(-15deg); }
  20% { transform: rotateZ(10deg); }
  25% { transform: rotateZ(-10deg); }
  30% { transform: rotateZ(6deg); }
  35% { transform: rotateZ(-4deg); }
  40%, 100% { transform: rotateZ(0deg); }
}

.wiggle {
  animation: wiggle 2s ease-in-out infinite;
}

/* Gradient color shift */
@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.gradient-animate {
  background: linear-gradient(-45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #ffeaa7);
  background-size: 400% 400%;
  animation: gradient-shift 3s ease infinite;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Floating effect */
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

.float {
  animation: float 3s ease-in-out infinite;
}

/* Sparkle effect */
@keyframes sparkle {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.1); }
}

.sparkle {
  animation: sparkle 1.5s ease-in-out infinite;
}
</style>
