(function () {
	const loginForm = document.querySelector(".login-form");
	const usernameInput = document.getElementById("username");
	const passwordInput = document.getElementById("password");
	const forgotLink = document.querySelector(".forgot-link");
	const resetModal = document.getElementById("resetPasswordModal");
	const resetRequestForm = document.getElementById("resetRequestForm");
	const resetCompleteForm = document.getElementById("resetCompleteForm");
	const resetIdentifierInput = document.getElementById("resetIdentifier");
	const resetCodeInput = document.getElementById("resetCode");
	const resetNewPasswordInput = document.getElementById("resetNewPassword");
	const resetConfirmPasswordInput = document.getElementById("resetConfirmPassword");
	const resetStatus = document.getElementById("resetPasswordStatus");
	const resetBackToLoginButton = document.getElementById("resetBackToLogin");
	const resetBackToRequestButton = document.getElementById("resetBackToRequest");
	const resetResendButton = document.getElementById("resetResendCode");

	let pendingResetIdentifier = "";

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

	function setResetMessage(message, isError) {
		if (!resetStatus) {
			return;
		}

		resetStatus.textContent = message;
		resetStatus.classList.toggle("is-error", Boolean(isError));
	}

	function showResetStep(step) {
		if (!resetRequestForm || !resetCompleteForm) {
			return;
		}

		const isRequestStep = step === "request";
		resetRequestForm.hidden = !isRequestStep;
		resetCompleteForm.hidden = isRequestStep;
	}

	function openResetModal() {
		if (!resetModal) {
			return;
		}

		resetModal.hidden = false;
		resetModal.setAttribute("aria-hidden", "false");
		document.body.classList.add("is-reset-open");
		setResetMessage("Enter your username or email to receive a reset code.", false);
		showResetStep("request");
		if (resetIdentifierInput) {
			resetIdentifierInput.focus();
		}
	}

	function closeResetModal() {
		if (!resetModal) {
			return;
		}

		resetModal.hidden = true;
		resetModal.setAttribute("aria-hidden", "true");
		document.body.classList.remove("is-reset-open");
		pendingResetIdentifier = "";
		if (resetRequestForm) {
			resetRequestForm.reset();
		}
		if (resetCompleteForm) {
			resetCompleteForm.reset();
		}
		showResetStep("request");
		setResetMessage("", false);
	}

	function syncPendingIdentifier(value) {
		pendingResetIdentifier = String(value || "").trim();
		if (resetIdentifierInput) {
			resetIdentifierInput.value = pendingResetIdentifier;
		}
	}

	function requestResetCode(identifier) {
		if (!window.campusVoiceDesktop?.requestPasswordReset) {
			setResetMessage("Password reset is unavailable right now.", true);
			return;
		}

		setResetMessage("Sending reset code...", false);
		window.campusVoiceDesktop.requestPasswordReset(identifier)
			.then((result) => {
				if (!result?.ok) {
					setResetMessage(result?.message || "Unable to send reset code.", true);
					return;
				}

				syncPendingIdentifier(identifier);
				showResetStep("complete");
				setResetMessage(result.message || `Reset code sent to ${result.destination || "the email on file"}. Enter it below to continue.`, false);
				if (resetCodeInput) {
					resetCodeInput.focus();
				}
			})
			.catch((error) => {
				setResetMessage(error?.message || "Unable to send reset code.", true);
			});
	}

	function completePasswordReset(code, newPassword, confirmPassword) {
		if (!window.campusVoiceDesktop?.completePasswordReset) {
			setResetMessage("Password reset is unavailable right now.", true);
			return;
		}

		if (newPassword !== confirmPassword) {
			setResetMessage("New password entries do not match.", true);
			return;
		}

		setResetMessage("Verifying code and updating password...", false);
		window.campusVoiceDesktop.completePasswordReset(pendingResetIdentifier, code, newPassword)
			.then((result) => {
				if (!result?.ok) {
					setResetMessage(result?.message || "Unable to update password.", true);
					return;
				}

				setResetMessage(result.message || "Password updated successfully. You can now log in.", false);
				window.setTimeout(() => {
					const rememberedIdentifier = pendingResetIdentifier;
					closeResetModal();
					if (usernameInput && rememberedIdentifier) {
						usernameInput.value = rememberedIdentifier;
					}
					if (passwordInput) {
						passwordInput.value = "";
						passwordInput.focus();
					}
					setMessage("Password reset complete. Please log in with your new password.", false);
				}, 900);
			})
			.catch((error) => {
				setResetMessage(error?.message || "Unable to update password.", true);
			});
	}

	if (forgotLink) {
		forgotLink.addEventListener("click", (event) => {
			event.preventDefault();
			openResetModal();
		});
	}

	if (resetBackToLoginButton) {
		resetBackToLoginButton.addEventListener("click", closeResetModal);
	}

	if (resetBackToRequestButton) {
		resetBackToRequestButton.addEventListener("click", () => {
			showResetStep("request");
			setResetMessage("Enter your username or email to receive a new reset code.", false);
			if (resetIdentifierInput) {
				resetIdentifierInput.focus();
			}
		});
	}

	if (resetResendButton) {
		resetResendButton.addEventListener("click", () => {
			if (!pendingResetIdentifier) {
				setResetMessage("Enter your username or email first.", true);
				showResetStep("request");
				if (resetIdentifierInput) {
					resetIdentifierInput.focus();
				}
				return;
			}

			requestResetCode(pendingResetIdentifier);
		});
	}

	if (resetModal) {
		resetModal.addEventListener("click", (event) => {
			const target = event.target;
			if (target instanceof HTMLElement && target.matches("[data-reset-close]")) {
				closeResetModal();
			}
		});

		document.addEventListener("keydown", (event) => {
			if (event.key === "Escape" && !resetModal.hidden) {
				closeResetModal();
			}
		});
	}

	if (resetRequestForm) {
		resetRequestForm.addEventListener("submit", (event) => {
			event.preventDefault();

			const identifier = resetIdentifierInput?.value.trim();
			if (!identifier) {
				setResetMessage("Enter your username or email.", true);
				if (resetIdentifierInput) {
					resetIdentifierInput.focus();
				}
				return;
			}

			syncPendingIdentifier(identifier);
			requestResetCode(identifier);
		});
	}

	if (resetCompleteForm) {
		resetCompleteForm.addEventListener("submit", (event) => {
			event.preventDefault();

			const code = resetCodeInput?.value.trim();
			const newPassword = resetNewPasswordInput?.value || "";
			const confirmPassword = resetConfirmPasswordInput?.value || "";

			if (!code || code.length !== 6) {
				setResetMessage("Enter the 6-digit code from your email.", true);
				if (resetCodeInput) {
					resetCodeInput.focus();
				}
				return;
			}

			if (!newPassword || newPassword.length < 6) {
				setResetMessage("Choose a new password with at least 6 characters.", true);
				if (resetNewPasswordInput) {
					resetNewPasswordInput.focus();
				}
				return;
			}

			completePasswordReset(code, newPassword, confirmPassword);
		});
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
				window.sessionStorage.setItem("campusvoice-admin-id", String(admin.id || ""));
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
