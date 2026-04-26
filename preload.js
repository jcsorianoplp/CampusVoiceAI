const { contextBridge, ipcRenderer } = require("electron");

// Keep renderer isolated; expose a minimal, safe API surface for future use.
contextBridge.exposeInMainWorld("campusVoiceDesktop", {
	platform: process.platform,
	dbPing: () => ipcRenderer.invoke("db:ping"),
	loginAdmin: (username, password) => ipcRenderer.invoke("auth:login", { username, password }),
	requestPasswordReset: (identifier) => ipcRenderer.invoke("auth:request-password-reset", { identifier }),
	completePasswordReset: (identifier, code, newPassword) => ipcRenderer.invoke("auth:complete-password-reset", { identifier, code, newPassword })
});
