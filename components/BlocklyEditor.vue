<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';

import * as Blockly from "blockly/core";
import * as En from "blockly/msg/en";
import * as libraryBlocks from 'blockly/blocks';

import initBlocks from '~/blockly/blocks/gogo-block';
import initGenerator from '~/blockly/generators/gogo-generator'
import customCategory from '~/blockly/custom-category'
import xmlToolbox from '~/blockly/gogo-toolbox'

const { $mqtt } = useNuxtApp(); // Get Blockly & MQTT from Nuxt plugin
const blocklyCommandTopic = ref("gogo-pgc/blockly/command")
const remoteCommandTopic = ref("gogo-pgc/remote/command")
let onMessageHandler; // Store the event handler reference

const blocklyDiv = ref(null);
const generatedCode = ref('');
let workspace = null;
let gogoGenerator = null;

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
                'movement_blocks': {
                    'colourPrimary': '#2965CC',
                    'colourSecondary': '#66A3FF',
                    'colourTertiary': '#1A3F7A',
                }
            },
            categoryStyles: {
                'movement_category': {
                    'colour': '#2965CC'
                }
            },
            componentStyles: {
                workspaceBackgroundColour: '#f8f9fa',
                toolboxBackgroundColour: '#ffffff',
                toolboxForegroundColour: '#000000',
                flyoutBackgroundColour: '#ffffff',
                flyoutOpacity: 1,
                scrollbarColour: '#cccccc',
            },
        }),
        theme: 'modern',
    });

    // Track user-added blocks
    workspace.addChangeListener((event) => {
        // get the last created block
        if (event.type === Blockly.Events.BLOCK_CREATE) {
            const newBlocks = event.ids.map((id) => workspace.getBlockById(id));
            lastActiveBlock = newBlocks[newBlocks.length - 1];
        }

        // track the block being moved as active
        if (event.type === Blockly.Events.BLOCK_MOVE) {
            const movedBlock = workspace.getBlockById(event.blockId);
            if (movedBlock) {
                lastActiveBlock = movedBlock;
            }
        }

        // if the last active block is deleted, find a new valid one
        if (event.type === Blockly.Events.BLOCK_DELETE) {
            if (lastActiveBlock && event.ids.includes(lastActiveBlock.id)) {
                const allBlocks = workspace.getAllBlocks(false);
                lastActiveBlock = allBlocks.length > 0 ? allBlocks[allBlocks.length - 1] : null;
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
        if (topic != remoteCommandTopic.value) return;

        const command = message.toString().trim(); // Convert to string and trim
        console.log(`📩 On topic: ${topic} received: ${message.toString()}`);

        // Check if the message is a known Blockly block command
        createBlockFromCommand(command);
    };

    // Attach the event listener
    $mqtt.on("message", onMessageHandler);
});

onBeforeUnmount(() => {
    if ($mqtt) {
        $mqtt.removeListener("message", onMessageHandler); // Remove listener
    }
});

const createBlockFromCommand = (command) => {
    const blockMapping = {
        forward: "movement_forward",
        backward: "movement_backward",
        left: "movement_left",
        right: "movement_right",
    };

    const blockType = blockMapping[command];
    if (!blockType) {
        console.warn(`No matching block for command: ${command}`);
        return;
    }

    const newBlock = workspace.newBlock(blockType);
    newBlock.initSvg();
    newBlock.render();

    // if there's a last active block, connect this one to it
    if (lastActiveBlock && lastActiveBlock.nextConnection && newBlock.previousConnection) {
        lastActiveBlock.nextConnection.connect(newBlock.previousConnection);
    }

    // Update lastActiveBlock to this new MQTT-created block
    lastActiveBlock = newBlock;
};

const copyCode = () => {
    navigator.clipboard.writeText(generatedCode.value);
};

const publishToMQTT = () => {
    if ($mqtt && generatedCode.value != "") {
        // Split commands line by line
        const commands = generatedCode.value.trim().split("\n");
        const topic = blocklyCommandTopic.value

        // Send each command separately
        commands.forEach((command, index) => {
            setTimeout(() => {
                $mqtt.publish(topic, command);
                console.log(`📩 On topic: ${topic} sent: ${command}`);
            }, index * 500); // 500ms delay between commands
        });
    }
};
</script>

<template>
    <div class="p-6 h-screen bg-gray-100 flex flex-col">
        <h1 class="text-2xl font-bold mb-4 text-center">GoGo Programming Continuum</h1>

        <!-- Main Layout: Blockly Left, Code Right -->
        <div class="flex flex-1 gap-4">
            <!-- Blockly Workspace -->
            <div class="flex-1 border rounded bg-white">
                <div id="blocklyDiv" class="w-full h-full"></div>
            </div>

            <!-- Code & Publish Section -->
            <div class="w-1/3 flex flex-col">
                <!-- Generated Code Display (2/3 of height) -->
                <div class="flex-1 p-4 bg-gray-900 text-white rounded-md">
                    <h3 class="text-lg font-bold mb-2 flex justify-between items-center">
                        Generated Code
                        <button @click="copyCode" class="text-xs px-2 py-1 bg-blue-600 rounded">
                            Copy
                        </button>
                    </h3>
                    <p class="p-4 bg-gray-800 text-sm rounded font-mono whitespace-pre-wrap overflow-auto h-2/3">
                        {{ generatedCode }}
                    </p>
                </div>

                <!-- Publish Button (1/3 of height) -->
                <div class="mt-4 flex justify-center">
                    <button @click="publishToMQTT"
                        class="px-6 py-3 bg-green-600 text-white font-bold rounded hover:bg-green-700">
                        Publish to MQTT
                    </button>
                </div>
            </div>
        </div>

    </div>
</template>

<style>
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
