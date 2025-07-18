export interface WebHIDDevice {
    collections: Array<{
        usagePage: number;
        usage: number;
    }>;
    opened: boolean;
    open(): Promise<void>;
    close(): Promise<void>;
    sendReport(reportId: number, data: Uint8Array): Promise<void>;
}

export interface WebHIDConnectOptions {
    deviceFilters: Array<{
        vendorId?: number;
        productId?: number;
        usagePage?: number;
        usage?: number;
    }>;
    isPrompt: boolean;
    connectHandler: (reporter: (data: Uint8Array) => Promise<void>) => void;
    disconnectHandler: (event: { device: WebHIDDevice }) => void;
    messageHandler: (data: Uint8Array) => void;
}

export interface WebHIDPlugin {
    isSupported(): boolean;
    openDevice(device: WebHIDDevice, handler: (data: Uint8Array) => void): Promise<(data: Uint8Array) => Promise<void>>;
    connect(options: WebHIDConnectOptions): Promise<(data: Uint8Array) => Promise<void>>;
    disconnect(): Promise<void>;
}

declare module '#app' {
    interface NuxtApp {
        $webhid: WebHIDPlugin;
    }
}

declare module '@vue/runtime-core' {
    interface ComponentCustomProperties {
        $webhid: WebHIDPlugin;
    }
}

