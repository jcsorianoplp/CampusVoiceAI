const { app, BrowserWindow } = require("electron");
const path = require("path");

function createMainWindow() {
	const window = new BrowserWindow({
		width: 1280,
		height: 820,
		minWidth: 1000,
		minHeight: 700,
		autoHideMenuBar: true,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true
		}
	});

	window.loadFile(path.join(__dirname, "HTML", "Admin", "AdminDashboard.html"));
}

app.whenReady().then(() => {
	createMainWindow();

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createMainWindow();
		}
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});
