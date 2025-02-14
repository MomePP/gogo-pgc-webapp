<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';

import * as Blockly from "blockly/core";
import * as En from "blockly/msg/en";

import initBlocks from '~/blockly/blocks/gogo-block';
import initGenerator from '~/blockly/generators/gogo-generator'

const { $mqtt } = useNuxtApp(); // Get Blockly & MQTT from Nuxt plugin
const receivedMessage = ref(""); // Store last received MQTT message
let onMessageHandler; // Store the event handler reference

const blocklyDiv = ref(null);
let workspace = null;
let gogoGenerator = null;

let lastActiveBlock = null; // Track the last block used (from MQTT or user)

onMounted(() => {
    initBlocks(Blockly)
    gogoGenerator = initGenerator(Blockly)

    workspace = Blockly.inject('blocklyDiv', {
        toolbox: document.getElementById("toolbox"),
        renderer: 'zelos',
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
    });

    // Avoid duplicate event listeners
    if (onMessageHandler) {
        $mqtt.removeListener("message", onMessageHandler);
    }

    // Define the MQTT message handler
    onMessageHandler = (topic, message) => {
        const command = message.toString().trim(); // Convert to string and trim
        receivedMessage.value = command;
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

const generateCode = () => {
    if (workspace) {
        const code = gogoGenerator.workspaceToCode(workspace);
        console.log("Generated Code:\n", code);
        // TODO: send to MQTT per command by split generated line
    } else {
        console.error("workspace ref is not yet available");
    }
};

const createBlockFromCommand = (command) => {
    const blockMapping = {
        forward: "control_forward",
        backward: "control_backward",
        left: "control_left",
        right: "control_right",
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
</script>

<template>
    <div class="p-6 h-screen bg-gray-100">
        <h1 class="text-2xl font-bold mb-4">Blockly Editor</h1>
        <div id="blocklyDiv" class="border rounded bg-white h-4/5"></div>
        <button @click="generateCode" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Generate Code
        </button>

        <xml id="toolbox" style="display: none">
            <category name="Movement" colour="#418bd2">
                <block type="control_forward"></block>
                <block type="control_backward"></block>
                <block type="control_left"></block>
                <block type="control_right"></block>
            </category>
        </xml>
    </div>
</template>
