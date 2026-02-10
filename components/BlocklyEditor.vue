<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { useMqttConnection } from '~/composables/useMqttConnection';
import { isSidebarCollapsed, notify, notifyWithUndo } from '~/composables/useLayoutState';

import * as Blockly from "blockly/core";
import * as En from "blockly/msg/en";
import * as libraryBlocks from 'blockly/blocks';

import initBlocks from '~/blockly/blocks/gogo-block';
import initGenerator from '~/blockly/generators/gogo-generator'
import customCategory from '~/blockly/custom-category'
import xmlToolbox from '~/blockly/gogo-toolbox'
import { getBunch, highlightBunch, clearHighlight, combineBunch, separateBunch, isCombinable, isSeparable } from '~/blockly/combineBlocks'

const { $mqtt } = useNuxtApp(); // Get Blockly & MQTT from Nuxt plugin
const { webhidConnected } = useWebHID()
const { channel, is_connected, connectChannel } = useMqttConnection()
const connectedChannelKey = ref("");
const remoteTopic = ref(useRuntimeConfig().public.mqttRemoteTopic || "");
const blocklyTopic = ref(useRuntimeConfig().public.mqttBlocklyTopic || "");
const controlTopic = ref(useRuntimeConfig().public.mqttControlTopic || "");
let onMessageHandler; // Store the event handler reference
let previousWorkspaceXml = null; // For undo feature (stores XML Element)

// localStorage key for workspace persistence
const WORKSPACE_STORAGE_KEY = 'gogo_blockly_workspace';

const generatedCode = ref('');
let workspace = Blockly.WorkspaceSvg;
let gogoGenerator = null;

// Combine blocks feature state
const showCombinePopup = ref(false);
const combinePopupPosition = ref({ x: 0, y: 0 });
const lastClickPos = ref(null);
const currentBunch = ref([]);

// Separate blocks feature state
const showSeparatePopup = ref(false);
const separatePopupPosition = ref({ x: 0, y: 0 });
const currentCombinedBlock = ref(null);

// Markdown modal state
const showMarkdownModal = ref(false);
const markdownModalTitle = ref('');
const markdownModalUrl = ref('');

const openGuide = (title, url) => {
    markdownModalTitle.value = title;
    markdownModalUrl.value = url;
    showMarkdownModal.value = true;
};

const closeGuide = () => {
    showMarkdownModal.value = false;
};

// Local channel state to decouple input from global state
const localChannel = ref(channel.value);

// Watch for global channel changes (e.g. from Settings Panel)
watch(channel, (newVal) => {
    if (newVal !== localChannel.value) {
        localChannel.value = newVal;
    }
});

const handleConnect = () => {
    channel.value = localChannel.value;
    connectChannel();
}

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
    ['S', 'stop'],
    ['P', 'beep']
]);

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
        zoom: {
            controls: true, // Enable zoom in/out buttons
            wheel: true,    // Optional: enable mouse wheel zoom
            startScale: 1,
            maxScale: 2,
            minScale: 0.3,
            scaleSpeed: 1.2
        },
        move: {
            scrollbars: true,
            drag: true,
            wheel: true
        },
        trashcan: true
    });

    // Load workspace from localStorage or initialize with default
    if (!loadWorkspaceFromStorage()) {
        initWorkspace();
    }
    workspace.scrollCenter()

    // Keep the flyout always visible
    const toolbox = workspace.getToolbox();
    if (toolbox) {
        const flyout = toolbox.getFlyout();
        if (flyout) {
            flyout.autoClose = false; // Prevent the flyout from closing when a block is dragged out
        }

        const toolboxItems = toolbox.getToolboxItems();
        if (toolboxItems.length > 0) {
            toolbox.setSelectedItem(toolboxItems[0]); // Select the first category to open the flyout
        }
    }

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

        // Clear combine popup when blocks are moved (prevents stale highlight after dragging)
        if (event.type === Blockly.Events.BLOCK_MOVE) {
            if (currentBunch.value.length > 0) {
                const movedBlockId = event.blockId;
                const isPartOfBunch = currentBunch.value.some(b => b.id === movedBlockId);
                if (isPartOfBunch) {
                    hideCombinePopup();
                }
            }
        }

        // Combine/Separate blocks feature: detect on block click
        if (event.type === Blockly.Events.CLICK && event.blockId) {
            const clickedBlock = workspace.getBlockById(event.blockId);

            // Check if it's a combined block that can be separated
            if (clickedBlock && isSeparable(clickedBlock.type)) {
                hideCombinePopup();
                currentCombinedBlock.value = clickedBlock;

                // Position popup near the block
                const blockSvg = clickedBlock.getSvgRoot();
                if (blockSvg) {
                    const blockRect = blockSvg.getBoundingClientRect();
                    const containerRect = document.getElementById('blocklyDiv').getBoundingClientRect();

                    separatePopupPosition.value = {
                        x: blockRect.right - containerRect.left + 10,
                        y: blockRect.top - containerRect.top + 5
                    };
                    showSeparatePopup.value = true;
                }
            }
            // Check if it's a combinable block with a bunch
            else if (clickedBlock && isCombinable(clickedBlock.type)) {
                hideSeparatePopup();
                const bunch = getBunch(clickedBlock);
                if (bunch.length >= 2) {
                    currentBunch.value = bunch;
                    highlightBunch(bunch);

                    // Position popup near the first block of the bunch
                    const firstBlock = bunch[0];
                    const blockSvg = firstBlock.getSvgRoot();
                    if (blockSvg) {
                        const blockRect = blockSvg.getBoundingClientRect();
                        const containerRect = document.getElementById('blocklyDiv').getBoundingClientRect();

                        combinePopupPosition.value = {
                            x: blockRect.right - containerRect.left + 10,
                            y: blockRect.top - containerRect.top + 5
                        };
                        showCombinePopup.value = true;
                    }
                } else {
                    hideCombinePopup();
                }
            } else {
                hideCombinePopup();
                hideSeparatePopup();
            }
        }

        // Hide popups when clicking workspace background
        if (event.type === Blockly.Events.CLICK && !event.blockId) {
            hideCombinePopup();
            hideSeparatePopup();
        }
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

        // Extract first 4-digit repeat count if available
        let repeatCount = 1;
        let commandsPart = commandPacket;

        if (/^\d{4}/.test(commandPacket)) {
            repeatCount = parseInt(commandPacket.slice(0, 4)) || 1;
            commandsPart = commandPacket.slice(4);
        }

        // Save current workspace state before clearing (for undo feature)
        const savedState = saveWorkspaceState();
        previousWorkspaceXml = savedState;

        // Clear all existing blocks and reinitialize workspace
        clearBlocks();

        // Find the main_start block and set it as lastActiveBlock
        const allBlocks = workspace.getAllBlocks();
        const mainStartBlock = allBlocks.find(block => block.type === 'main_start');
        lastActiveBlock = mainStartBlock || null;

        // Set repeat count field
        if (mainStartBlock) {
            mainStartBlock.setFieldValue(repeatCount.toString(), 'repeat');
        }

        for (const command of resolveCommandPacket(commandsPart)) {
            createBlockFromCommand(command);
        }

        // Show undo toast if there was previous content
        if (savedState) {
            notifyWithUndo('Code loaded from robot', () => {
                if (previousWorkspaceXml) {
                    restoreWorkspaceState(previousWorkspaceXml);
                    previousWorkspaceXml = null;
                }
            }, 10000);
        } else {
            notify('Code loaded from robot', 'success');
        }
    };

    // Attach the event listener
    $mqtt.on("message", onMessageHandler);

    // Save workspace to localStorage when page is closed/refreshed
    window.addEventListener('beforeunload', saveWorkspaceToStorage);
});

onBeforeUnmount(() => {
    // Save workspace before unmounting
    saveWorkspaceToStorage();

    // Cleanup event listeners
    window.removeEventListener('beforeunload', saveWorkspaceToStorage);
    if ($mqtt) {
        $mqtt.removeListener("message", onMessageHandler);
    }
});

watch(isSidebarCollapsed, () => {
    setTimeout(() => {
        Blockly.svgResize(workspace);
    }, 250);
});

// Watch for Cloud Disconnection
watch(is_connected, (connected, wasConnected) => {
    if (connected) {
        notify('Cloud connected successfully!', 'success');
        connectedChannelKey.value = channel.value; // Store the active channel
    } else if (wasConnected && !connected) {
        // Only notify error if the channel in the input matches the one that was connected
        // (If they are different, it means the user is intentionally switching)
        if (connectedChannelKey.value === channel.value) {
            notify('Cloud connection lost. Check your internet.', 'error');
        }
    }
});

// Watch for USB Disconnection
watch(webhidConnected, (connected, wasConnected) => {
    if (wasConnected && !connected) {
        notify('USB Device unplugged.', 'error');
    }
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
        beep: "movement_beep",
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
    let xmlWorkspace = Blockly.utils.xml.textToDom(`<xml><block type="main_start" deletable="false"></block></xml>`)
    Blockly.Xml.domToWorkspace(xmlWorkspace, workspace)
}

// Save workspace to localStorage
const saveWorkspaceToStorage = () => {
    try {
        const xmlDom = Blockly.Xml.workspaceToDom(workspace);
        const xmlText = Blockly.Xml.domToText(xmlDom);
        localStorage.setItem(WORKSPACE_STORAGE_KEY, xmlText);
    } catch (e) {
        console.warn('Failed to save workspace to localStorage:', e);
    }
};

// Load workspace from localStorage
const loadWorkspaceFromStorage = () => {
    try {
        const xmlText = localStorage.getItem(WORKSPACE_STORAGE_KEY);
        if (xmlText) {
            const xmlDom = Blockly.utils.xml.textToDom(xmlText);
            Blockly.Xml.domToWorkspace(xmlDom, workspace);
            return true;
        }
    } catch (e) {
        console.warn('Failed to load workspace from localStorage:', e);
    }
    return false;
};

const clearBlocks = () => {
    workspace.clear()
    initWorkspace()
};

// Undo feature: Save workspace state before overwriting
const saveWorkspaceState = () => {
    const mainStart = workspace.getAllBlocks().find(b => b.type === 'main_start');
    const hasContent = mainStart?.getInput('statement')?.connection?.isConnected();
    return hasContent ? Blockly.Xml.workspaceToDom(workspace) : null;
};

// Undo feature: Restore workspace from saved state
const restoreWorkspaceState = (xmlDom) => {
    workspace.clear();
    Blockly.Xml.domToWorkspace(xmlDom, workspace);
    notify('Code restored!', 'success');
};

const controlDownload = () => {
    if (!$mqtt) return;

    if (channel.value === "") {
        console.log("⚠️ Channel is empty.");
        return false;
    }
    // console.log(`👀 Generated code\n\n${generatedCode.value}`);

    const codeLines = generatedCode.value.trim().split("\n");
    const commands = [];
    let programRepeat = 0;
    let inStartBlock = false;

    for (const line of codeLines) {
        const trimmed = line.trim().toLowerCase();

        if (trimmed.startsWith("start")) {
            programRepeat = parseInt(trimmed.split(" ")[1]) || 1;
            console.log(`🔁 Program repeat set to ${programRepeat}`);

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
        return false;
    }

    // INFO: generate command packet, repeat count is 4-digit prefix
    const commandPacket = `${programRepeat.toString().padStart(4, '0')}` + constructCommandPacket(commands)
    // console.log(`👀 Generated packet\n\n${commandPacket}`);

    const topic = blocklyTopic.value + channel.value;
    $mqtt.publish(topic, commandPacket);
    console.log(`📩 [${channel.value}] sent: ${commandPacket}`);
    return true; // Success
};

const controlRun = () => {
    const topic = controlTopic.value + channel.value;
    $mqtt.publish(topic, 'run');
    console.log(`📩 [${channel.value}] sent: run`);
};

const isSending = ref(false);
const isStopping = ref(false);
const isUploading = ref(false);

const handleRunCode = () => {
    if (isSending.value) return;
    isSending.value = true;

    // 1. Send Code
    const sent = controlDownload();
    
    // 2. If sent successfully, wait briefly then Run
    if (sent) {
        setTimeout(() => {
            controlRun();
            // Keep feedback visible slightly longer for better UX
            setTimeout(() => { isSending.value = false; }, 300);
        }, 400);
    } else {
        isSending.value = false;
    }
}

const controlStop = () => {
    if (isStopping.value) return;
    isStopping.value = true;

    const topic = controlTopic.value + channel.value;
    $mqtt.publish(topic, 'stop');
    console.log(`📩 [${channel.value}] sent: stop`);

    setTimeout(() => { isStopping.value = false; }, 400);
};

const controlUpload = () => {
    if (isUploading.value) return;
    isUploading.value = true;

    const topic = controlTopic.value + channel.value;
    $mqtt.publish(topic, 'upload');
    console.log(`📩 [${channel.value}] sent: upload`);

    setTimeout(() => { isUploading.value = false; }, 400);
};

// Combine blocks feature functions
const hideCombinePopup = () => {
    showCombinePopup.value = false;
    currentBunch.value = [];
    clearHighlight();
};

const handleCombine = () => {
    if (currentBunch.value.length >= 2) {
        // Use requestAnimationFrame to ensure this runs outside the current Blockly event loop
        // to avoid conflicts with the click event processing.
        requestAnimationFrame(() => {
            combineBunch(currentBunch.value, workspace, Blockly);
            hideCombinePopup();
        });
    } else {
        hideCombinePopup();
    }
};

// Separate blocks feature functions
const hideSeparatePopup = () => {
    showSeparatePopup.value = false;
    currentCombinedBlock.value = null;
};

const handleSeparate = () => {
    if (currentCombinedBlock.value) {
        requestAnimationFrame(() => {
            separateBunch(currentCombinedBlock.value, workspace, Blockly);
            hideSeparatePopup();
        });
    } else {
        hideSeparatePopup();
    }
};
</script>

<template>
    <div class="h-screen bg-gray-50 flex flex-col overflow-hidden">
        <!-- Header -->
        <header class="px-6 py-3 bg-white border-b border-gray-100 flex justify-between items-center z-20">
            <div class="flex items-center gap-4">
                <!-- Main Logo Icon Theme -->
                <div class="p-2 bg-indigo-500/10 rounded-xl text-indigo-600">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" 
                            d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                </div>
                <h1 class="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent tracking-wide">
                    GoGo Programming Continuum
                </h1>
            </div>
        </header>

        <!-- Main Workspace Area -->
        <main class="flex-1 relative min-h-0">
            <!-- Floating Top-Right Controls -->
            <div class="absolute top-6 right-8 flex items-center gap-3 z-30">
                <MessageMonitor />
            </div>

            <!-- Workspace -->
            <div id="blocklyDiv" class="absolute inset-0"></div>

            <!-- Combine Popup Button -->
            <button
                v-if="showCombinePopup"
                class="combine-popup"
                :style="{ left: combinePopupPosition.x + 'px', top: combinePopupPosition.y + 'px' }"
                @click="handleCombine"
            >
                <svg class="combine-popup-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8l4 4-4 4m16-8l-4 4 4 4" />
                </svg>
                Combine
            </button>

            <!-- Separate Popup Button -->
            <button
                v-if="showSeparatePopup"
                class="separate-popup"
                :style="{ left: separatePopupPosition.x + 'px', top: separatePopupPosition.y + 'px' }"
                @click="handleSeparate"
            >
                <svg class="separate-popup-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Separate
            </button>
        </main>

        <!-- Footer / Control Panel -->
        <footer class="w-full px-6 py-4 bg-white border-t border-gray-100 z-20 flex items-center relative">
            <!-- Help Guide Icons (Left-aligned) -->
            <div class="flex items-center gap-2">
                <button @click="openGuide('Robot Car Guide', '/docs/robot-car-guide.md')"
                   class="p-2.5 rounded-xl text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                   title="Robot Car Guide">
                    <!-- Robot Car Icon -->
                    <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="8" width="18" height="8" rx="2" />
                        <circle cx="7" cy="16" r="2" />
                        <circle cx="17" cy="16" r="2" />
                        <path d="M5 8V6a2 2 0 012-2h10a2 2 0 012 2v2" />
                        <line x1="12" y1="4" x2="12" y2="8" />
                    </svg>
                </button>
                <button @click="openGuide('IR Remote Guide', '/docs/ir-remote-guide.md')"
                   class="p-2.5 rounded-xl text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                   title="IR Remote Guide">
                    <!-- Remote Control Icon -->
                    <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="6" y="2" width="12" height="20" rx="2" />
                        <circle cx="12" cy="7" r="2" />
                        <line x1="9" y1="12" x2="9" y2="12.01" />
                        <line x1="12" y1="12" x2="12" y2="12.01" />
                        <line x1="15" y1="12" x2="15" y2="12.01" />
                        <line x1="9" y1="15" x2="9" y2="15.01" />
                        <line x1="12" y1="15" x2="12" y2="15.01" />
                        <line x1="15" y1="15" x2="15" y2="15.01" />
                        <line x1="9" y1="18" x2="9" y2="18.01" />
                        <line x1="12" y1="18" x2="12" y2="18.01" />
                        <line x1="15" y1="18" x2="15" y2="18.01" />
                    </svg>
                </button>
            </div>

            <!-- Run/Stop Controls (Right-aligned) -->
            <div class="flex items-center gap-2 ml-auto">
                <button @click="handleRunCode" :disabled="isSending || isStopping"
                    class='flex items-center gap-2 px-6 py-2 text-base font-bold rounded-full transition-all duration-150 shadow-sm'
                    :class="isSending ? 'bg-green-50 text-green-400 border border-green-100 cursor-not-allowed' : 'bg-green-100 text-green-700 border border-green-300 hover:bg-green-200 hover:border-green-400'">
                    
                    <svg v-if="isSending" class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="size-5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                    </svg>
                    <span>{{ isSending ? 'Sending...' : 'Run Code' }}</span>
                </button>

                <!-- Upload from Robot Button -->
                <button @click="controlUpload" :disabled="isUploading || isSending || isStopping"
                    class='flex items-center size-10 justify-center rounded-full transition-all duration-150 border'
                    :class="isUploading ? 'bg-indigo-50 text-indigo-300 border-indigo-100 cursor-not-allowed scale-95' : 'bg-indigo-100 text-indigo-700 border-indigo-300 hover:bg-indigo-200 hover:border-indigo-400'"
                    title="Upload from Robot">
                    <svg v-if="isUploading" class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="size-5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                </button>

                <button @click="controlStop" :disabled="isStopping"
                    class='flex items-center size-10 justify-center rounded-full transition-all duration-150 border'
                    :class="isStopping ? 'bg-red-50 text-red-300 border-red-100 cursor-not-allowed scale-95' : 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200 hover:border-red-400'">
                    <svg v-if="isStopping" class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" class="size-5">
                        <rect x="5" y="5" width="14" height="14" rx="2" />
                    </svg>
                </button>
            </div>
        </footer>

        <!-- Markdown Guide Modal -->
        <MarkdownModal
            :show="showMarkdownModal"
            :title="markdownModalTitle"
            :markdown-url="markdownModalUrl"
            @close="closeGuide"
        />
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

    0%,
    7% {
        transform: rotateZ(0deg);
    }

    15% {
        transform: rotateZ(-15deg);
    }

    20% {
        transform: rotateZ(10deg);
    }

    25% {
        transform: rotateZ(-10deg);
    }

    30% {
        transform: rotateZ(6deg);
    }

    35% {
        transform: rotateZ(-4deg);
    }

    40%,
    100% {
        transform: rotateZ(0deg);
    }
}

.wiggle {
    animation: wiggle 2s ease-in-out infinite;
}

/* Gradient color shift */
@keyframes gradient-shift {
    0% {
        background-position: 0% 50%;
    }

    50% {
        background-position: 100% 50%;
    }

    100% {
        background-position: 0% 50%;
    }
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

    0%,
    100% {
        transform: translateY(0px);
    }

    50% {
        transform: translateY(-10px);
    }
}

.float {
    animation: float 3s ease-in-out infinite;
}

/* Sparkle effect */
@keyframes sparkle {

    0%,
    100% {
        opacity: 1;
        transform: scale(1);
    }

    50% {
        opacity: 0.8;
        transform: scale(1.1);
    }
}

.sparkle {
    animation: sparkle 1.5s ease-in-out infinite;
}
</style>
