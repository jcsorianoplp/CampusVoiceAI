const { app, BrowserWindow } = require("electron");
const { ipcMain } = require("electron");
const crypto = require("crypto");
const path = require("path");
const nodemailer = require("nodemailer");
require("dotenv").config();
const { pool, testConnection } = require("./db");
const { loadAdminState, saveAdminState, saveSuggestionStatus, saveSuggestionDelete, resolveOrganizationContext } = require("./backendState");

function createMailTransport() {
	const host = process.env.CV_SMTP_HOST;
	const user = process.env.CV_SMTP_USER;
	const pass = process.env.CV_SMTP_PASS;

	if (!host || !user || !pass) {
		return null;
	}

	return nodemailer.createTransport({
		host,
		port: Number(process.env.CV_SMTP_PORT || 587),
		secure: String(process.env.CV_SMTP_SECURE || "false") === "true",
		auth: { user, pass }
	});
}

function generateResetCode() {
	return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function hashResetCode(code) {
	return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function maskEmail(email) {
	const value = String(email || "").trim();
	const atIndex = value.indexOf("@");

	if (atIndex <= 1) {
		return value || "the email on file";
	}

	return `${value[0]}***${value.slice(atIndex - 1)}`;
}

const mailTransport = createMailTransport();


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

ipcMain.handle("org:resolve", async (_event, payload) => {
	try {
		const organization = await resolveOrganizationContext(pool, payload);
		if (!organization) {
			return {
				ok: false,
				message: "Unable to resolve the requested organization."
			};
		}

		return {
			ok: true,
			organization
		};
	} catch (error) {
		return {
			ok: false,
			message: error instanceof Error ? error.message : "Unable to resolve the requested organization."
		};
	}
});

ipcMain.handle("app:state:load", async (_event, payload) => {
	try {
		return await loadAdminState(pool, payload);
	} catch (error) {
		return {
			ok: false,
			message: error instanceof Error ? error.message : "Unable to load application state."
		};
	}
});

ipcMain.handle("app:state:save", async (_event, payload) => {
	try {
		return await saveAdminState(pool, payload);
	} catch (error) {
		return {
			ok: false,
			message: error instanceof Error ? error.message : "Unable to save application state."
		};
	}
});

ipcMain.handle("suggestion:update-status", async (_event, payload) => {
	try {
		return await saveSuggestionStatus(pool, payload);
	} catch (error) {
		return {
			ok: false,
			message: error instanceof Error ? error.message : "Unable to update suggestion status."
		};
	}
});

ipcMain.handle("suggestion:delete", async (_event, payload) => {
    try {
        return await saveSuggestionDelete(pool, payload);
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : "Unable to delete suggestion."
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

ipcMain.handle("auth:request-password-reset", async (_event, payload) => {
	const identifier = String(payload?.identifier || "").trim();

	if (!identifier) {
		return {
			ok: false,
			message: "Enter your username or email."
		};
	}

	if (!mailTransport) {
		return {
			ok: false,
			message: "Email service is not configured yet."
		};
	}

	try {
		const [rows] = await pool.execute(
			`SELECT id, username, email, full_name
			 FROM admins
			 WHERE username = ? OR email = ?
			 LIMIT 1`,
			[identifier, identifier]
		);

		if (!rows.length) {
			return {
				ok: false,
				message: "No admin account matched that username or email."
			};
		}

		const admin = rows[0];
		const resetCode = generateResetCode();
		const expiresMinutes = Number(process.env.CV_RESET_CODE_MINUTES || 15);

		await pool.execute(
			"DELETE FROM password_resets WHERE admin_id = ? AND used_at IS NULL",
			[admin.id]
		);

		await pool.execute(
			`INSERT INTO password_resets (admin_id, code_hash, expires_at)
			 VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? MINUTE))`,
			[admin.id, hashResetCode(resetCode), expiresMinutes]
		);

		await mailTransport.sendMail({
			from: process.env.CV_SMTP_FROM || process.env.CV_SMTP_USER,
			to: admin.email,
			subject: "Campus Voice password reset code",
			text: [
				`Hello ${admin.full_name || admin.username},`,
				"",
				`Your Campus Voice reset code is: ${resetCode}`,
				`This code expires in ${expiresMinutes} minute(s).`,
				"",
				"If you did not request this code, you can ignore this message."
			].join("\n")
		});

		return {
			ok: true,
			message: "Reset code sent.",
			destination: maskEmail(admin.email)
		};
	} catch (error) {
		return {
			ok: false,
			message: error instanceof Error ? error.message : "Unable to send reset code."
		};
	}
});

ipcMain.handle("auth:complete-password-reset", async (_event, payload) => {
	const identifier = String(payload?.identifier || "").trim();
	const code = String(payload?.code || "").trim();
	const newPassword = String(payload?.newPassword || "");

	if (!identifier || !code || !newPassword) {
		return {
			ok: false,
			message: "Fill out the reset form completely."
		};
	}

	if (code.length !== 6) {
		return {
			ok: false,
			message: "Enter the 6-digit reset code."
		};
	}

	try {
		const [adminRows] = await pool.execute(
			`SELECT id, username, email
			 FROM admins
			 WHERE username = ? OR email = ?
			 LIMIT 1`,
			[identifier, identifier]
		);

		if (!adminRows.length) {
			return {
				ok: false,
				message: "No admin account matched that username or email."
			};
		}

		const admin = adminRows[0];
		const [resetRows] = await pool.execute(
			`SELECT id, code_hash, expires_at
			 FROM password_resets
			 WHERE admin_id = ? AND used_at IS NULL
			 ORDER BY created_at DESC
			 LIMIT 1`,
			[admin.id]
		);

		if (!resetRows.length) {
			return {
				ok: false,
				message: "No active reset code was found. Request a new one."
			};
		}

		const resetRow = resetRows[0];
		if (new Date(resetRow.expires_at).getTime() < Date.now()) {
			return {
				ok: false,
				message: "That reset code has expired. Request a new one."
			};
		}

		if (hashResetCode(code) !== resetRow.code_hash) {
			return {
				ok: false,
				message: "The reset code is incorrect."
			};
		}

		await pool.execute(
			"UPDATE admins SET password_hash = ? WHERE id = ?",
			[newPassword, admin.id]
		);

		await pool.execute(
			"UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = ?",
			[resetRow.id]
		);

		return {
			ok: true,
			message: "Password updated successfully."
		};
	} catch (error) {
		return {
			ok: false,
			message: error instanceof Error ? error.message : "Unable to update password."
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
