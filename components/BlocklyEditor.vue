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
const broadcastTopic = ref(useRuntimeConfig().public.broadcastTopic || "");
const broadcastPassword = ref(useRuntimeConfig().public.broadcastPassword || "");
let onMessageHandler; // Store the event handler reference

const isPlaying = ref(false);
const isRecording = ref(false);

const generatedCode = ref('');
let workspace = Blockly.WorkspaceSvg;
let gogoGenerator = null;

let lastReceivedTime = 0;
let lastActiveBlock = null; // Track the last block used (from MQTT or user)

onMounted(() => {
    customCategory(Blockly)
    initBlocks(Blockly)
    gogoGenerator = initGenerator(Blockly)
    Blockly.setLocale(En);

    workspace = Blockly.inject('blocklyDiv', {
        toolbox: xmlToolbox,
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
        theme: 'modern',
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
        let checkingTopic = broadcastTopic.value + channel.value
        if (!topic.startsWith(checkingTopic)) return;

        // const command = message.toString().trim(); // Convert to string and trim
        const command = topic.substring(topic.lastIndexOf('/') + 1)
        const time = Date.now();
        console.log(`📩 ${time} - On channel: ${channel.value} received: ${command}`);

        // Check if the message is a known Blockly block command
        if (isRecording.value) {
            if (lastReceivedTime) {
                let diff = time - lastReceivedTime
                createBlockFromCommand('wait ' + diff)
            }
            lastReceivedTime = time

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

const playCommands = async ({ fast }) => {
    if (!$mqtt || generatedCode.value.trim() === "" || isPlaying.value) return;

    if (channel.value === "") {
        console.log("⚠️ Channel is empty.");
        return;
    }

    console.log(`👀 Generated code\n\n${generatedCode.value}`);
    isPlaying.value = true;

    const codeLines = generatedCode.value.trim().split("\n");
    const topic = broadcastTopic.value + channel.value + "/";

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

    for (let i = 0; i < commands.length && isPlaying.value; i++) {
        const command = commands[i];

        if (command.startsWith("wait ")) {
            const delay = parseInt(command.split(" ")[1]);
            if (!isNaN(delay)) {
                if (fast) {
                    console.log(`⏭️  Skipping wait of ${delay}ms`);
                } else {
                    console.log(`⏳ Waiting ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
            continue;
        }

        const commandTopic = topic + command;
        $mqtt.publish(commandTopic, broadcastPassword.value);
        console.log(`📩 [${channel.value}] sent: ${command}`);

        await new Promise(resolve => setTimeout(resolve, 200)); // fallback delay between commands
    }

    isPlaying.value = false;
};

const controlRecording = () => {
    isRecording.value = !isRecording.value
    if (isRecording.value) {
        console.log("🟢 Recording started.");
        lastReceivedTime = 0
    } else {
        console.log("🔴 Recording stopped.");
    }
};

const controlPlay = () => playCommands({ fast: false });

const controlPlayFast = () => playCommands({ fast: true });

const controlStop = () => {
    isPlaying.value = false;
    console.log("🛑 Playback stopped.");
};
</script>

<template>
    <div class="h-screen bg-gray-100 flex flex-col">
        <!-- Header -->
        <header class="px-6 py-3 bg-white border-b border-gray-200 shadow-sm flex justify-between items-center">
            <h1 class="text-2xl font-semibold text-gray-800">GoGo Programming Continuum</h1>
            <button @click="clearBlocks"
                class="text-gray-500 hover:text-gray-800 flex items-center gap-1 text-sm font-medium transition-colors duration-150">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                    stroke="currentColor" class="w-4 h-4">
                    <path stroke-linecap="round" stroke-linejoin="round"
                        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
                Clear Blocks
            </button>
        </header>

        <!-- Blockly Workspace -->
        <div class="flex-1 relative">
            <div id="blocklyDiv" class="absolute inset-0"></div>
        </div>

        <!-- Footer / Control Panel -->
        <footer class="px-6 py-4 bg-white border-t border-gray-200 shadow-inner flex flex-col items-center gap-5">
            <!-- Record Button -->
            <button @click="controlRecording" :class="[
                'w-full max-w-sm text-white py-2 rounded-md flex items-center justify-center gap-2 transition-colors duration-150',
                isRecording ? 'bg-gray-600 hover:bg-gray-700' : 'bg-red-600 hover:bg-red-700'
            ]">
                <!-- Icon changes based on isRecording -->
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="white" viewBox="0 0 24 24">
                    <circle v-if="!isRecording" cx="12" cy="12" r="10" />
                    <rect v-else x="6" y="6" width="12" height="12" rx="2" />
                </svg>

                <span>{{ isRecording ? 'Stop Recording' : 'Record' }}</span>
            </button>

            <!-- Playback Buttons -->
            <div class="flex space-x-8 text-gray-600 select-none">
                <button @click="controlStop" class="hover:text-black transition-colors duration-150" aria-label="Stop">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" class="w-6 h-6">
                        <path fill-rule="evenodd"
                            d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z"
                            clip-rule="evenodd" />
                    </svg>
                </button>
                <button @click="controlPlay" class="hover:text-black transition-colors duration-150" aria-label="Play">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" class="w-10 h-10">
                        <path fill-rule="evenodd"
                            d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm14.024-.983a1.125 1.125 0 0 1 0 1.966l-5.603 3.113A1.125 1.125 0 0 1 9 15.113V8.887c0-.857.921-1.4 1.671-.983l5.603 3.113Z"
                            clip-rule="evenodd" />
                    </svg>
                </button>
                <button @click="controlPlayFast" class="hover:text-black transition-colors duration-150"
                    aria-label="Fast Forward">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" class="w-6 h-6">
                        <path
                            d="M5.055 7.06C3.805 6.347 2.25 7.25 2.25 8.69v8.122c0 1.44 1.555 2.343 2.805 1.628L12 14.471v2.34c0 1.44 1.555 2.343 2.805 1.628l7.108-4.061c1.26-.72 1.26-2.536 0-3.256l-7.108-4.061C13.555 6.346 12 7.249 12 8.689v2.34L5.055 7.061Z" />
                    </svg>
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
