const { app, BrowserWindow } = require("electron");
const { ipcMain } = require("electron");
const path = require("path");
const { pool, testConnection } = require("./db");


async function createMainWindow() {
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

	await window.webContents.session.clearStorageData({
		storages: ["localstorage"]
	});

	window.loadFile(path.join(__dirname, "HTML", "Admin", "Login.html"));
}

ipcMain.handle("db:ping", async () => {
	try {
		await testConnection();
		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			message: error instanceof Error ? error.message : "Unable to connect to the database."
		};
	}
});

ipcMain.handle("auth:login", async (_event, credentials) => {
	const username = String(credentials?.username || "").trim();
	const password = String(credentials?.password || "");

	if (!username || !password) {
		return {
			ok: false,
			message: "Enter both username and password."
		};
	}

	try {
		const [rows] = await pool.execute(
			`SELECT
				a.id,
				a.org_id,
				a.username,
				a.full_name,
				a.role,
				o.name AS organization_name,
				o.slug AS organization_slug,
				o.accent_color AS organization_accent_color
			 FROM admins a
			 INNER JOIN organizations o ON o.id = a.org_id
			 WHERE a.username = ? AND a.password_hash = ?
			 LIMIT 1`,
			[username, password]
		);

		if (!rows.length) {
			return {
				ok: false,
				message: "Invalid username or password."
			};
		}

		const admin = rows[0];

		await pool.execute(
			"UPDATE admins SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?",
			[admin.id]
		);

		return {
			ok: true,
			admin: {
				id: admin.id,
				orgId: admin.org_id,
				username: admin.username,
				fullName: admin.full_name,
				role: admin.role,
				organizationName: admin.organization_name,
				organizationSlug: admin.organization_slug,
				organizationAccentColor: admin.organization_accent_color
			}
		};
	} catch (error) {
		return {
			ok: false,
			message: error instanceof Error ? error.message : "Unable to authenticate user."
		};
	}
});

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
