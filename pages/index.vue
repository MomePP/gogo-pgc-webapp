<script setup>
import MqttPanel from "~/components/mqtt-panel.vue";
import BlocklyEditor from "~/components/blockly-editor.vue";
</script>

<template>
  <div class="flex h-screen">
    <!-- Left Sidebar (MQTT Panel) -->
    <div class="w-1/5 bg-gray-900 text-white">
      <MqttPanel />
    </div>

    <!-- Right Panel (Blockly) -->
    <div class="w-4/5">
      <BlocklyEditor />
    </div>
  </div>
</template>
