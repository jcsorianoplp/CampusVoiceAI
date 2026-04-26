(function () {
	const loginForm = document.querySelector(".login-form");
	const usernameInput = document.getElementById("username");
	const passwordInput = document.getElementById("password");

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

		if (!window.campusVoiceDesktop?.loginAdmin) {
			setMessage("Database login is unavailable right now.", true);
			return;
		}

		setMessage("Checking credentials...", false);
		window.campusVoiceDesktop.loginAdmin(username, password)
			.then((result) => {
				if (!result?.ok) {
					setMessage(result?.message || "Invalid username or password.", true);
					return;
				}

				const admin = result.admin;
				window.CampusVoiceAdminAuth?.login(admin.username);
				window.sessionStorage.setItem("campusvoice-admin-role", admin.role || "OrgAdmin");
				window.sessionStorage.setItem("campusvoice-admin-org-id", String(admin.orgId || ""));
				window.sessionStorage.setItem("campusvoice-admin-org-name", admin.organizationName || "");
				window.sessionStorage.setItem("campusvoice-admin-full-name", admin.fullName || "");
				window.sessionStorage.setItem("campusvoice-admin-username", admin.username || "");
				setMessage("Login successful. Redirecting...", false);
				window.setTimeout(() => {
					window.location.replace("./AdminDashboard.html");
				}, 250);
			})
			.catch((error) => {
				setMessage(error?.message || "Unable to authenticate user.", true);
			});
	});

	const savedUser = window.CampusVoiceAdminAuth?.getLastUser();
	if (savedUser && usernameInput && !usernameInput.value) {
		usernameInput.value = savedUser;
	}
})();
