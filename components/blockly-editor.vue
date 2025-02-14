<script setup>
import { onMounted, ref } from "vue";

import * as Blockly from "blockly/core";
import * as libraryBlocks from "blockly/blocks";
import { javascriptGenerator } from "blockly/javascript";
import * as En from "blockly/msg/en";

// Set language messages
Blockly.setLocale(En);

const workspace = ref(null);

onMounted(() => {
    workspace.value = Blockly.inject("blocklyDiv", {
        toolbox: `
      <xml>
        <block type="controls_if"></block>
        <block type="logic_compare"></block>
        <block type="math_number"></block>
        <block type="text"></block>
      </xml>
    `,
    });
});

const generateCode = () => {
    const code = javascriptGenerator.workspaceToCode(workspace.value);
    console.log("Generated Code:", code);
};
</script>

<template>
    <div class="p-6 h-screen bg-gray-100">
        <h1 class="text-2xl font-bold mb-4">Blockly Editor</h1>
        <div id="blocklyDiv" class="border rounded bg-white h-4/5"></div>
        <button @click="generateCode" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Generate Code
        </button>
    </div>
</template>
