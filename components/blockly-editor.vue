<script setup>
import { onMounted, ref } from 'vue';

import * as Blockly from "blockly/core";
import * as En from "blockly/msg/en";

import initBlocks from '~/blockly/blocks/gogo-block';
import initGenerator from '~/blockly/generators/gogo-generator'

const workspace = ref(null);
const blocklyDiv = ref(null);
let gogoGenerator = null;

onMounted(() => {
    initBlocks(Blockly)
    gogoGenerator = initGenerator(Blockly)

    workspace.value = Blockly.inject('blocklyDiv', {
        toolbox: toolbox,
        renderer: 'zelos',
    });
});

const generateCode = () => {
    if (workspace.value) {
        const code = gogoGenerator.workspaceToCode(workspace.value);
        console.log("Generated Code:\n", code);
    } else {
        console.error("workspace ref is not yet available");
    }
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
                <block type="control_turn_left"></block>
                <block type="control_turn_right"></block>
            </category>
        </xml>
    </div>
</template>
