(function () {
	const PROFILE_STORAGE_KEY = "campusvoice-admin-profile-settings";
	let modalElements = null;

	function loadState() {
		try {
			const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
			if (!raw) {
				return {
					name: "Campus Voice Admin",
					email: "admin@campusvoice.ai",
					organization: "Computer Society",
					role: "Organization Admin",
					bio: "Handles student feedback intake, moderation, and reporting.",
					theme: "System",
					notificationsEmail: true,
					notificationsInApp: true,
					reportReminder: true,
					autoSyncStats: true,
					avatarDataUrl: ""
				};
			}
			return JSON.parse(raw);
		} catch (error) {
			return {
				name: "Campus Voice Admin",
				email: "admin@campusvoice.ai",
				organization: "Computer Society",
				role: "Organization Admin",
				bio: "Handles student feedback intake, moderation, and reporting.",
				theme: "System",
				notificationsEmail: true,
				notificationsInApp: true,
				reportReminder: true,
				autoSyncStats: true,
				avatarDataUrl: ""
			};
		}
	}

	function saveState(nextState) {
		window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextState));
		syncProfileTriggerAvatar(nextState.avatarDataUrl, nextState.organization || nextState.name);
		syncProfileIdentity(nextState);
	}

	function syncProfileIdentity(state) {
		const organizationName = state.organization || "Computer Society";
		const adminName = state.name || "Campus Voice Admin";
		const roleLabel = state.role || "Organization Admin";

		document.querySelectorAll(".admin-sidebar-card-value").forEach((element) => {
			element.textContent = organizationName;
		});

		document.querySelectorAll(".admin-sidebar-card-note").forEach((element) => {
			element.textContent = `${adminName} • ${roleLabel}`;
		});

		const reportHeader = document.querySelector(".admin-report-toolbar h2");
		if (reportHeader) {
			reportHeader.textContent = `Generate clear reports for ${organizationName}`;
		}
	}

	function getInitials(text) {
		const tokens = String(text || "")
			.trim()
			.split(/\s+/)
			.filter(Boolean);

		if (!tokens.length) {
			return "CV";
		}

		return tokens.slice(0, 2).map((token) => token[0]).join("").toUpperCase();
	}

	function syncProfileTriggerAvatar(avatarDataUrl, labelText) {
		const triggers = Array.from(document.querySelectorAll(".admin-profile-trigger"));
		const initials = getInitials(labelText);

		triggers.forEach((trigger) => {
			if (avatarDataUrl) {
				trigger.innerHTML = `<img src="${avatarDataUrl}" alt="Profile" />`;
				return;
			}

			trigger.innerHTML = `<span aria-hidden="true">${initials}</span>`;
		});
	}

	function updateAvatarPreview() {
		if (!modalElements) {
			return;
		}

		const hasImage = Boolean(modalElements.avatarDataUrl);
		modalElements.fields.avatarCircle.classList.toggle("has-image", hasImage);
		modalElements.fields.avatarPreview.src = hasImage ? modalElements.avatarDataUrl : "";
		modalElements.fields.avatarInitials.textContent = getInitials(modalElements.fields.organization.value || modalElements.fields.name.value);
	}

	function showFeedback(title, message) {
		if (!modalElements) {
			return;
		}

		if (modalElements.feedbackTitle) {
			modalElements.feedbackTitle.textContent = title;
		}

		if (modalElements.feedbackCopy) {
			modalElements.feedbackCopy.textContent = message;
		}

		modalElements.feedbackOverlay.classList.add("is-open");
	}

	function closeFeedback() {
		if (!modalElements) {
			return;
		}

		modalElements.feedbackOverlay.classList.remove("is-open");
	}

	function applyFormState(state) {
		if (!modalElements) {
			return;
		}

		const fields = modalElements.fields;
		fields.name.value = state.name || "";
		fields.email.value = state.email || "";
		fields.organization.value = state.organization || "";
		fields.role.value = state.role || "";
		fields.bio.value = state.bio || "";
		fields.theme.value = state.theme || "System";
		fields.notificationsEmail.checked = !!state.notificationsEmail;
		fields.notificationsInApp.checked = !!state.notificationsInApp;
		fields.reportReminder.checked = !!state.reportReminder;
		fields.autoSyncStats.checked = !!state.autoSyncStats;
		modalElements.avatarDataUrl = state.avatarDataUrl || "";
		updateAvatarPreview();
		syncProfileTriggerAvatar(modalElements.avatarDataUrl, state.organization || state.name);
		syncProfileIdentity(state);
	}

	function collectFormState() {
		if (!modalElements) {
			return loadState();
		}

		const fields = modalElements.fields;
		return {
			name: fields.name.value.trim(),
			email: fields.email.value.trim(),
			organization: fields.organization.value.trim(),
			role: fields.role.value.trim(),
			bio: fields.bio.value.trim(),
			theme: fields.theme.value,
			notificationsEmail: fields.notificationsEmail.checked,
			notificationsInApp: fields.notificationsInApp.checked,
			reportReminder: fields.reportReminder.checked,
			autoSyncStats: fields.autoSyncStats.checked,
			avatarDataUrl: modalElements.avatarDataUrl || ""
		};
	}

	function closeModal() {
		if (!modalElements) {
			return;
		}

		modalElements.overlay.classList.remove("is-open");
	}

	function buildModal() {
		const overlay = document.createElement("div");
		overlay.className = "admin-account-overlay";
		overlay.innerHTML = `
			<div class="admin-account-modal" role="dialog" aria-modal="true" aria-label="Account settings">
				<div class="admin-account-layout">
					<aside class="admin-account-sidebar">
						<button class="admin-account-tab is-active" type="button" data-account-tab="profile"><i class="bi bi-person-circle" aria-hidden="true"></i>Profile</button>
						<button class="admin-account-tab" type="button" data-account-tab="settings"><i class="bi bi-gear" aria-hidden="true"></i>Settings</button>
					</aside>
					<section class="admin-account-main">
						<div class="admin-account-panel is-active" data-account-panel="profile">
							<div class="admin-account-title">Profile</div>
							<div class="admin-account-copy">Update your account details shown across admin activities and report exports.</div>
							<div class="admin-account-avatar">
								<div class="admin-account-avatar-circle" id="accountAvatarCircle">
									<img id="accountAvatarPreview" alt="Organization profile" />
									<span class="admin-account-avatar-initials" id="accountAvatarInitials">CV</span>
								</div>
								<div class="admin-account-avatar-copy">
									<div class="admin-account-avatar-actions">
										<button class="admin-secondary-btn" type="button" id="accountAvatarUploadBtn">Upload Picture</button>
										<button class="admin-secondary-btn" type="button" id="accountAvatarClearBtn">Remove</button>
									</div>
									<div class="admin-account-avatar-note">Use square image for best fit. PNG/JPG supported.</div>
									<input id="accountAvatarInput" type="file" accept="image/png,image/jpeg,image/webp" hidden />
								</div>
							</div>
							<div class="admin-account-grid">
								<div class="admin-account-field"><label for="accountName">Full Name</label><input id="accountName" type="text" /></div>
								<div class="admin-account-field"><label for="accountEmail">Email</label><input id="accountEmail" type="email" /></div>
								<div class="admin-account-field"><label for="accountOrganization">Organization</label><input id="accountOrganization" type="text" /></div>
								<div class="admin-account-field"><label for="accountRole">Role</label><input id="accountRole" type="text" /></div>
							</div>
							<div class="admin-account-field"><label for="accountBio">Bio</label><textarea id="accountBio"></textarea></div>
						</div>
						<div class="admin-account-panel" data-account-panel="settings">
							<div class="admin-account-title">Settings</div>
							<div class="admin-account-copy">Manage preferences for notifications, reporting reminders, and workspace behavior.</div>
							<div class="admin-account-grid">
								<div class="admin-account-field">
									<label for="accountTheme">Theme Preference</label>
									<select id="accountTheme">
										<option value="System">System</option>
										<option value="Light">Light</option>
										<option value="Dark">Dark</option>
									</select>
								</div>
							</div>
							<div class="admin-account-switches">
								<label><input id="accountNotificationsEmail" type="checkbox" /> Email notifications</label>
								<label><input id="accountNotificationsInApp" type="checkbox" /> In-app notifications</label>
								<label><input id="accountReportReminder" type="checkbox" /> Weekly report reminder</label>
								<label><input id="accountAutoSyncStats" type="checkbox" /> Auto-sync public stats</label>
							</div>
						</div>
					</section>
				</div>
				<div class="admin-account-actions">
					<button class="admin-secondary-btn" type="button" data-account-discard>Discard All Changes</button>
					<button class="admin-primary-btn" type="button" data-account-save>Save Changes</button>
				</div>
			</div>
		`;
		document.body.appendChild(overlay);

		const feedbackOverlay = document.createElement("div");
		feedbackOverlay.className = "admin-feedback-overlay";
		feedbackOverlay.innerHTML = `
			<div class="admin-feedback-modal" role="dialog" aria-modal="true" aria-label="Change feedback">
				<div class="admin-feedback-title" id="accountFeedbackTitle">Changes updated</div>
				<div class="admin-feedback-copy" id="accountFeedbackCopy">Changes have been saved successfully.</div>
				<div class="admin-feedback-actions">
					<button class="admin-primary-btn" type="button" data-account-feedback-close>OK</button>
				</div>
			</div>
		`;
		document.body.appendChild(feedbackOverlay);

		modalElements = {
			overlay,
			avatarDataUrl: "",
			feedbackOverlay,
			tabs: Array.from(overlay.querySelectorAll("[data-account-tab]")),
			panels: Array.from(overlay.querySelectorAll("[data-account-panel]")),
			saveBtn: overlay.querySelector("[data-account-save]"),
			discardBtn: overlay.querySelector("[data-account-discard]"),
			feedbackCloseBtn: feedbackOverlay.querySelector("[data-account-feedback-close]"),
			feedbackTitle: feedbackOverlay.querySelector("#accountFeedbackTitle"),
			feedbackCopy: feedbackOverlay.querySelector("#accountFeedbackCopy"),
			fields: {
				avatarCircle: overlay.querySelector("#accountAvatarCircle"),
				avatarPreview: overlay.querySelector("#accountAvatarPreview"),
				avatarInitials: overlay.querySelector("#accountAvatarInitials"),
				avatarInput: overlay.querySelector("#accountAvatarInput"),
				avatarUploadBtn: overlay.querySelector("#accountAvatarUploadBtn"),
				avatarClearBtn: overlay.querySelector("#accountAvatarClearBtn"),
				name: overlay.querySelector("#accountName"),
				email: overlay.querySelector("#accountEmail"),
				organization: overlay.querySelector("#accountOrganization"),
				role: overlay.querySelector("#accountRole"),
				bio: overlay.querySelector("#accountBio"),
				theme: overlay.querySelector("#accountTheme"),
				notificationsEmail: overlay.querySelector("#accountNotificationsEmail"),
				notificationsInApp: overlay.querySelector("#accountNotificationsInApp"),
				reportReminder: overlay.querySelector("#accountReportReminder"),
				autoSyncStats: overlay.querySelector("#accountAutoSyncStats")
			}
		};

		modalElements.tabs.forEach((tab) => {
			tab.addEventListener("click", () => {
				const nextTab = tab.getAttribute("data-account-tab");
				modalElements.tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
				modalElements.panels.forEach((panel) => panel.classList.toggle("is-active", panel.getAttribute("data-account-panel") === nextTab));
			});
		});

		overlay.addEventListener("click", (event) => {
			if (event.target === overlay) {
				closeModal();
			}
		});

		feedbackOverlay.addEventListener("click", (event) => {
			if (event.target === feedbackOverlay) {
				closeFeedback();
			}
		});

		modalElements.feedbackCloseBtn?.addEventListener("click", closeFeedback);

		modalElements.fields.avatarUploadBtn?.addEventListener("click", () => {
			modalElements.fields.avatarInput?.click();
		});

		modalElements.fields.avatarInput?.addEventListener("change", () => {
			const file = modalElements.fields.avatarInput.files?.[0];
			if (!file) {
				return;
			}

			const reader = new FileReader();
			reader.onload = () => {
				if (typeof reader.result === "string") {
					modalElements.avatarDataUrl = reader.result;
					updateAvatarPreview();
				}
			};
			reader.readAsDataURL(file);
		});

		modalElements.fields.avatarClearBtn?.addEventListener("click", () => {
			modalElements.avatarDataUrl = "";
			if (modalElements.fields.avatarInput) {
				modalElements.fields.avatarInput.value = "";
			}
			updateAvatarPreview();
		});

		modalElements.fields.organization?.addEventListener("input", updateAvatarPreview);
		modalElements.fields.name?.addEventListener("input", updateAvatarPreview);

		modalElements.saveBtn?.addEventListener("click", () => {
			const nextState = collectFormState();
			saveState(nextState);
			showFeedback("Changes Saved", "Changes have been saved successfully.");
			closeModal();
		});

		modalElements.discardBtn?.addEventListener("click", () => {
			applyFormState(loadState());
			showFeedback("Changes Discarded", "Changes have been discarded successfully.");
			closeModal();
		});

		document.addEventListener("keydown", (event) => {
			if (event.key !== "Escape") {
				return;
			}

			if (modalElements.feedbackOverlay.classList.contains("is-open")) {
				closeFeedback();
				return;
			}

			if (modalElements.overlay.classList.contains("is-open")) {
				closeModal();
			}
		});
	}

	function openModal(tabName) {
		if (!modalElements) {
			buildModal();
		}

		applyFormState(loadState());

		const nextTab = tabName === "settings" ? "settings" : "profile";
		modalElements.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.getAttribute("data-account-tab") === nextTab));
		modalElements.panels.forEach((panel) => panel.classList.toggle("is-active", panel.getAttribute("data-account-panel") === nextTab));
		modalElements.overlay.classList.add("is-open");
	}

	const initialProfileState = loadState();
	syncProfileTriggerAvatar(initialProfileState.avatarDataUrl, initialProfileState.organization || initialProfileState.name);
	syncProfileIdentity(initialProfileState);

	document.addEventListener("click", (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement)) {
			return;
		}

		const actionButton = target.closest("[data-profile-action]");
		if (!actionButton) {
			return;
		}

		const action = actionButton.getAttribute("data-profile-action");
		if (action === "profile") {
			event.preventDefault();
			openModal("profile");
		}

		if (action === "settings") {
			event.preventDefault();
			openModal("settings");
		}
	});
})();
