<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';

import * as Blockly from "blockly/core";
import * as En from "blockly/msg/en";
import * as libraryBlocks from 'blockly/blocks';

import initBlocks from '~/blockly/blocks/gogo-block';
import initGenerator from '~/blockly/generators/gogo-generator'
import customCategory from '~/blockly/custom-category'

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
        toolbox: document.getElementById("toolbox"),
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
        <h1 class="text-2xl font-bold mb-4 text-center">Blockly Editor</h1>

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

        <xml id="toolbox" style="display: none">
            <category name="Movement" categorystyle="movement_category">
                <block type="movement_forward"></block>
                <block type="movement_backward"></block>
                <block type="movement_left"></block>
                <block type="movement_right"></block>
            </category>
            <category name="Logic" categorystyle="logic_category">
                <block type="controls_if"></block>
                <block type="logic_compare"></block>
                <block type="logic_operation"></block>
                <block type="logic_negate"></block>
                <block type="logic_boolean"></block>
                <block type="logic_null" disabled="true"></block>
                <block type="logic_ternary"></block>
            </category>
            <category name="Loops" categorystyle="loop_category">
                <block type="controls_repeat_ext">
                    <value name="TIMES">
                        <shadow type="math_number">
                            <field name="NUM">10</field>
                        </shadow>
                    </value>
                </block>
                <block type="controls_repeat" disabled="true"></block>
                <block type="controls_whileUntil"></block>
                <block type="controls_for">
                    <value name="FROM">
                        <shadow type="math_number">
                            <field name="NUM">1</field>
                        </shadow>
                    </value>
                    <value name="TO">
                        <shadow type="math_number">
                            <field name="NUM">10</field>
                        </shadow>
                    </value>
                    <value name="BY">
                        <shadow type="math_number">
                            <field name="NUM">1</field>
                        </shadow>
                    </value>
                </block>
                <block type="controls_forEach"></block>
                <block type="controls_flow_statements"></block>
            </category>
            <category name="Math" categorystyle="math_category">
                <block type="math_number" gap="32">
                    <field name="NUM">123</field>
                </block>
                <block type="math_arithmetic">
                    <value name="A">
                        <shadow type="math_number">
                            <field name="NUM">1</field>
                        </shadow>
                    </value>
                    <value name="B">
                        <shadow type="math_number">
                            <field name="NUM">1</field>
                        </shadow>
                    </value>
                </block>
                <block type="math_single">
                    <value name="NUM">
                        <shadow type="math_number">
                            <field name="NUM">9</field>
                        </shadow>
                    </value>
                </block>
                <block type="math_trig">
                    <value name="NUM">
                        <shadow type="math_number">
                            <field name="NUM">45</field>
                        </shadow>
                    </value>
                </block>
                <block type="math_constant"></block>
                <block type="math_number_property">
                    <value name="NUMBER_TO_CHECK">
                        <shadow type="math_number">
                            <field name="NUM">0</field>
                        </shadow>
                    </value>
                </block>
                <block type="math_round">
                    <value name="NUM">
                        <shadow type="math_number">
                            <field name="NUM">3.1</field>
                        </shadow>
                    </value>
                </block>
                <block type="math_on_list"></block>
                <block type="math_modulo">
                    <value name="DIVIDEND">
                        <shadow type="math_number">
                            <field name="NUM">64</field>
                        </shadow>
                    </value>
                    <value name="DIVISOR">
                        <shadow type="math_number">
                            <field name="NUM">10</field>
                        </shadow>
                    </value>
                </block>
                <block type="math_constrain">
                    <value name="VALUE">
                        <shadow type="math_number">
                            <field name="NUM">50</field>
                        </shadow>
                    </value>
                    <value name="LOW">
                        <shadow type="math_number">
                            <field name="NUM">1</field>
                        </shadow>
                    </value>
                    <value name="HIGH">
                        <shadow type="math_number">
                            <field name="NUM">100</field>
                        </shadow>
                    </value>
                </block>
                <block type="math_random_int">
                    <value name="FROM">
                        <shadow type="math_number">
                            <field name="NUM">1</field>
                        </shadow>
                    </value>
                    <value name="TO">
                        <shadow type="math_number">
                            <field name="NUM">100</field>
                        </shadow>
                    </value>
                </block>
                <block type="math_random_float"></block>
                <block type="math_atan2">
                    <value name="X">
                        <shadow type="math_number">
                            <field name="NUM">1</field>
                        </shadow>
                    </value>
                    <value name="Y">
                        <shadow type="math_number">
                            <field name="NUM">1</field>
                        </shadow>
                    </value>
                </block>
            </category>
            <category name="Text" categorystyle="text_category">
                <block type="text"></block>
                <block type="text_join"></block>
                <block type="text_append">
                    <value name="TEXT">
                        <shadow type="text"></shadow>
                    </value>
                </block>
                <block type="text_length">
                    <value name="VALUE">
                        <shadow type="text">
                            <field name="TEXT">abc</field>
                        </shadow>
                    </value>
                </block>
                <block type="text_isEmpty">
                    <value name="VALUE">
                        <shadow type="text">
                            <field name="TEXT"></field>
                        </shadow>
                    </value>
                </block>
                <block type="text_indexOf">
                    <value name="VALUE">
                        <block type="variables_get">
                            <field name="VAR">text</field>
                        </block>
                    </value>
                    <value name="FIND">
                        <shadow type="text">
                            <field name="TEXT">abc</field>
                        </shadow>
                    </value>
                </block>
                <block type="text_charAt">
                    <value name="VALUE">
                        <block type="variables_get">
                            <field name="VAR">text</field>
                        </block>
                    </value>
                </block>
                <block type="text_getSubstring">
                    <value name="STRING">
                        <block type="variables_get">
                            <field name="VAR">text</field>
                        </block>
                    </value>
                </block>
                <block type="text_changeCase">
                    <value name="TEXT">
                        <shadow type="text">
                            <field name="TEXT">abc</field>
                        </shadow>
                    </value>
                </block>
                <block type="text_trim">
                    <value name="TEXT">
                        <shadow type="text">
                            <field name="TEXT">abc</field>
                        </shadow>
                    </value>
                </block>
                <block type="text_count">
                    <value name="SUB">
                        <shadow type="text"></shadow>
                    </value>
                    <value name="TEXT">
                        <shadow type="text"></shadow>
                    </value>
                </block>
                <block type="text_replace">
                    <value name="FROM">
                        <shadow type="text"></shadow>
                    </value>
                    <value name="TO">
                        <shadow type="text"></shadow>
                    </value>
                    <value name="TEXT">
                        <shadow type="text"></shadow>
                    </value>
                </block>
                <block type="text_reverse">
                    <value name="TEXT">
                        <shadow type="text"></shadow>
                    </value>
                </block>
                <label text="Input/Output:" web-class="ioLabel"></label>
                <block type="text_print">
                    <value name="TEXT">
                        <shadow type="text">
                            <field name="TEXT">abc</field>
                        </shadow>
                    </value>
                </block>
                <block type="text_prompt_ext">
                    <value name="TEXT">
                        <shadow type="text">
                            <field name="TEXT">abc</field>
                        </shadow>
                    </value>
                </block>
            </category>
            <category name="Lists" categorystyle="list_category">
                <block type="lists_create_with">
                    <mutation items="0"></mutation>
                </block>
                <block type="lists_create_with"></block>
                <block type="lists_repeat">
                    <value name="NUM">
                        <shadow type="math_number">
                            <field name="NUM">5</field>
                        </shadow>
                    </value>
                </block>
                <block type="lists_length"></block>
                <block type="lists_isEmpty"></block>
                <block type="lists_indexOf">
                    <value name="VALUE">
                        <block type="variables_get">
                            <field name="VAR">list</field>
                        </block>
                    </value>
                </block>
                <block type="lists_getIndex">
                    <value name="VALUE">
                        <block type="variables_get">
                            <field name="VAR">list</field>
                        </block>
                    </value>
                </block>
                <block type="lists_setIndex">
                    <value name="LIST">
                        <block type="variables_get">
                            <field name="VAR">list</field>
                        </block>
                    </value>
                </block>
                <block type="lists_getSublist">
                    <value name="LIST">
                        <block type="variables_get">
                            <field name="VAR">list</field>
                        </block>
                    </value>
                </block>
                <block type="lists_split">
                    <value name="DELIM">
                        <shadow type="text">
                            <field name="TEXT">,</field>
                        </shadow>
                    </value>
                </block>
                <block type="lists_sort"></block>
                <block type="lists_reverse"></block>
            </category>
            <sep></sep>
            <category name="Variables" categorystyle="variable_category" custom="VARIABLE"></category>
            <category name="Functions" categorystyle="procedure_category" custom="PROCEDURE"></category>
        </xml>
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
