import { ref } from 'vue';

export const isSidebarCollapsed = ref(true);
export const toggleSidebar = () => {
    isSidebarCollapsed.value = !isSidebarCollapsed.value;
};

export interface Notification {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}
export const notifications = ref<Notification[]>([]);
export const notify = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    notifications.value.push({ id, message, type });

    // Auto-remove after 4 seconds
    setTimeout(() => {
        notifications.value = notifications.value.filter(n => n.id !== id);
    }, 4000);
};
