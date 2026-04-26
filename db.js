const mysql = require("mysql2/promise");

const pool = mysql.createPool({
	host: process.env.CV_DB_HOST || "localhost",
	user: process.env.CV_DB_USER || "root",
	password: process.env.CV_DB_PASSWORD || "James123",
	database: process.env.CV_DB_NAME || "CampusVoiceAI",
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0
});

async function testConnection() {
	await pool.query("SELECT 1");
	return true;
}

module.exports = {
	pool,
	testConnection
}; 