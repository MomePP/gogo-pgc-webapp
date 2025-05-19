<script setup>
import SettingsPanel from "~/components/SettingsPanel.vue";
import BlocklyEditor from "~/components/BlocklyEditor.vue";
import { isSidebarCollapsed } from '~/composables/useLayoutState';

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
};
</script>

<template>
  <div class="flex h-screen">
    <!-- Left Sidebar (Settings Panel) -->
    <div :class="[
      'flex flex-col bg-gray-900 text-white transition-all duration-300 ease-in-out relative overflow-hidden',
      isSidebarCollapsed ? 'w-12' : 'min-w-[280px] w-1/5'
    ]">
      <!-- Collapse Toggle Button -->
      <button @click="toggleSidebar" class="absolute top-4 right-2 bg-gray-800 hover:bg-gray-700 text-white rounded p-1"
        :title="isSidebarCollapsed ? 'Expand' : 'Collapse'">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
          class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" :d="isSidebarCollapsed
            ? 'M15 19l-7-7 7-7'
            : 'M9 5l7 7-7 7'" />
        </svg>
      </button>

      <!-- Only render content when expanded -->
      <transition name="fade" mode="out-in">
        <div v-show="!isSidebarCollapsed" key="panel" class="p-4">
          <SettingsPanel />
        </div>
      </transition>
    </div>

    <!-- Right Panel (Blockly) -->
    <div class="flex-1">
      <BlocklyEditor />
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
