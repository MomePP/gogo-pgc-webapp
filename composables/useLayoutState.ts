import { ref } from 'vue';

export const isSidebarCollapsed = ref(false);
export const toggleSidebar = () => {
    isSidebarCollapsed.value = !isSidebarCollapsed.value;
};

export interface NotificationAction {
    label: string;
    handler: () => void;
}

export interface Notification {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
    action?: NotificationAction;
}

export const notifications = ref<Notification[]>([]);

// Track timeouts for cancellation
const notificationTimeouts = new Map<number, ReturnType<typeof setTimeout>>();

export const notify = (
    message: string,
    type: 'success' | 'error' | 'info' = 'info',
    options?: { action?: NotificationAction; duration?: number }
): number => {
    const id = Date.now();
    const duration = options?.duration ?? 4000;

    notifications.value.push({ id, message, type, action: options?.action });

    const timeout = setTimeout(() => {
        dismissNotification(id);
    }, duration);
    notificationTimeouts.set(id, timeout);

    return id;
};

export const dismissNotification = (id: number) => {
    const timeout = notificationTimeouts.get(id);
    if (timeout) {
        clearTimeout(timeout);
        notificationTimeouts.delete(id);
    }
    notifications.value = notifications.value.filter(n => n.id !== id);
};

export const notifyWithUndo = (message: string, undoHandler: () => void, duration = 5000): number => {
    return notify(message, 'info', { action: { label: 'Undo', handler: undoHandler }, duration });
};
