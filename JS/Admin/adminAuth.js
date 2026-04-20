(function () {
	const AUTH_KEY = "campusvoice-admin-authenticated";
	const LAST_USER_KEY = "campusvoice-admin-last-user";
	const isLoginPage = window.location.pathname.toLowerCase().includes("login.html");
	const isAuthenticated = () => window.localStorage.getItem(AUTH_KEY) === "true";

	function redirectToDashboard() {
		window.location.replace("./AdminDashboard.html");
	}

	function requireLogin() {
		if (isLoginPage) {
			if (isAuthenticated()) {
				redirectToDashboard();
			}
			return;
		}

		if (!isAuthenticated()) {
			window.location.replace("./Login.html");
		}
	}

	window.CampusVoiceAdminAuth = {
		isAuthenticated,
		login(username) {
			window.localStorage.setItem(AUTH_KEY, "true");
			if (username) {
				window.localStorage.setItem(LAST_USER_KEY, username);
			}
		},
		logout() {
			window.localStorage.removeItem(AUTH_KEY);
		},
		getLastUser() {
			return window.localStorage.getItem(LAST_USER_KEY) || "";
		},
		requireLogin
	};

	requireLogin();
})();
