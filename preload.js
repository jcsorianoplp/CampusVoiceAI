const { contextBridge } = require("electron");

// Keep renderer isolated; expose a minimal, safe API surface for future use.
contextBridge.exposeInMainWorld("campusVoiceDesktop", {
	platform: process.platform
});
