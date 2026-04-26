(function () {
	const AUTH_KEY = "campusvoice-admin-authenticated";
	const LAST_USER_KEY = "campusvoice-admin-last-user";
	const isLoginPage = window.location.pathname.toLowerCase().includes("login.html");
	const isAuthenticated = () => window.sessionStorage.getItem(AUTH_KEY) === "true";

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
			window.sessionStorage.setItem(AUTH_KEY, "true");
			if (username) {
				window.sessionStorage.setItem(LAST_USER_KEY, username);
			}
		},
		logout() {
			window.sessionStorage.removeItem(AUTH_KEY);
			window.sessionStorage.removeItem(LAST_USER_KEY);
		},
		getLastUser() {
			return window.sessionStorage.getItem(LAST_USER_KEY) || "";
		},
		requireLogin
	};

	requireLogin();
})();
