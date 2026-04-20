(function () {
	const loginForm = document.querySelector(".login-form");
	const usernameInput = document.getElementById("username");
	const passwordInput = document.getElementById("password");

	const DEFAULT_USERNAME = "admin";
	const DEFAULT_PASSWORD = "campusvoice123";

	if (!loginForm) {
		return;
	}

	if (window.CampusVoiceAdminAuth?.isAuthenticated()) {
		window.location.replace("./AdminDashboard.html");
		return;
	}

	const feedback = document.createElement("div");
	feedback.className = "login-feedback";
	feedback.setAttribute("aria-live", "polite");
	loginForm.insertBefore(feedback, loginForm.querySelector(".login-submit"));

	function setMessage(message, isError) {
		feedback.textContent = message;
		feedback.classList.toggle("is-error", Boolean(isError));
	}

	loginForm.addEventListener("submit", (event) => {
		event.preventDefault();

		const username = usernameInput?.value.trim();
		const password = passwordInput?.value;

		if (!username || !password) {
			setMessage("Enter both username and password.", true);
			return;
		}

		if (username === DEFAULT_USERNAME && password === DEFAULT_PASSWORD) {
			window.CampusVoiceAdminAuth?.login(username);
			setMessage("Login successful. Redirecting...", false);
			window.setTimeout(() => {
				window.location.replace("./AdminDashboard.html");
			}, 250);
			return;
		}

		setMessage("Invalid username or password.", true);
	});

	const savedUser = window.CampusVoiceAdminAuth?.getLastUser();
	if (savedUser && usernameInput && !usernameInput.value) {
		usernameInput.value = savedUser;
	}
})();
