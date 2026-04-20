(function () {
	const NOTIF_STORAGE_KEY = "campusvoice-admin-notifications";
	const NOTIF_LIMIT = 25;

	const profileMenus = Array.from(document.querySelectorAll("[data-admin-profile-menu]"));
	const bellButtons = Array.from(document.querySelectorAll(".admin-bell-btn"));
	if (!profileMenus.length && !bellButtons.length) {
		return;
	}

	const notificationMenus = [];
	let toastStack = document.querySelector(".admin-toast-stack");
	if (!toastStack) {
		toastStack = document.createElement("div");
		toastStack.className = "admin-toast-stack";
		document.body.appendChild(toastStack);
	}

	function loadNotifications() {
		try {
			const raw = window.localStorage.getItem(NOTIF_STORAGE_KEY);
			return raw ? JSON.parse(raw) : [];
		} catch (error) {
			return [];
		}
	}

	function saveNotifications(notifications) {
		window.localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(notifications.slice(0, NOTIF_LIMIT)));
	}

	function formatTime(timestamp) {
		try {
			return new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
		} catch (error) {
			return "Now";
		}
	}

	function showToast(title, message) {
		const toast = document.createElement("div");
		toast.className = "admin-toast";
		toast.innerHTML = `
			<div class="admin-toast-title">${title}</div>
			<div class="admin-toast-copy">${message}</div>
		`;
		toastStack.appendChild(toast);

		window.setTimeout(() => {
			toast.style.opacity = "0";
			toast.style.transform = "translateY(-6px)";
			window.setTimeout(() => toast.remove(), 180);
		}, 3200);
	}

	function renderNotifications() {
		const notifications = loadNotifications();
		const hasUnread = notifications.some((item) => !item.read);

		notificationMenus.forEach((menu) => {
			const list = menu.querySelector(".admin-notif-list");
			const dot = menu.querySelector(".admin-notif-dot");
			if (!list || !dot) {
				return;
			}

			dot.classList.toggle("is-visible", hasUnread);
			list.innerHTML = notifications.length
				? notifications.map((item) => `
					<div class="admin-notif-item">
						<div class="admin-notif-item-title">${item.title}</div>
						<div class="admin-notif-item-copy">${item.message}</div>
						<div class="admin-notif-item-time">${formatTime(item.createdAt)}</div>
					</div>
				`).join("")
				: '<div class="admin-notif-empty">No notifications right now.</div>';
		});
	}

	function addNotification(title, message, showPopup) {
		const notifications = loadNotifications();
		notifications.unshift({
			id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
			title,
			message,
			createdAt: new Date().toISOString(),
			read: false
		});
		saveNotifications(notifications);
		renderNotifications();
		if (showPopup) {
			showToast(title, message);
		}
	}

	function markAllRead() {
		const notifications = loadNotifications().map((item) => ({ ...item, read: true }));
		saveNotifications(notifications);
		renderNotifications();
	}

	function closeAllMenus() {
		profileMenus.forEach((menu) => {
			menu.classList.remove("is-open");
		});
		notificationMenus.forEach((menu) => {
			menu.classList.remove("is-open");
		});
	}

	bellButtons.forEach((button) => {
		const wrapper = document.createElement("div");
		wrapper.className = "admin-notif-menu";
		button.parentNode.insertBefore(wrapper, button);
		wrapper.appendChild(button);

		const dot = document.createElement("span");
		dot.className = "admin-notif-dot";
		wrapper.appendChild(dot);

		const dropdown = document.createElement("div");
		dropdown.className = "admin-notif-dropdown";
		dropdown.innerHTML = `
			<div class="admin-notif-head">
				<strong>Notifications</strong>
				<button class="admin-notif-clear" type="button">Mark all read</button>
			</div>
			<div class="admin-notif-list"></div>
		`;
		wrapper.appendChild(dropdown);

		const clearButton = dropdown.querySelector(".admin-notif-clear");
		if (clearButton) {
			clearButton.addEventListener("click", (event) => {
				event.stopPropagation();
				markAllRead();
			});
		}

		button.addEventListener("click", (event) => {
			event.stopPropagation();
			const wasOpen = wrapper.classList.contains("is-open");
			closeAllMenus();
			if (!wasOpen) {
				wrapper.classList.add("is-open");
				markAllRead();
			}
		});

		notificationMenus.push(wrapper);
	});

	profileMenus.forEach((menu) => {
		const trigger = menu.querySelector("[data-admin-profile-trigger]");
		if (!trigger) {
			return;
		}

		trigger.addEventListener("click", (event) => {
			event.stopPropagation();
			const wasOpen = menu.classList.contains("is-open");
			closeAllMenus();
			if (!wasOpen) {
				menu.classList.add("is-open");
			}
		});

		const actionItems = Array.from(menu.querySelectorAll(".admin-profile-item"));
		actionItems.forEach((item) => {
			item.addEventListener("click", () => {
				closeAllMenus();
			});
		});
	});

	document.addEventListener("click", (event) => {
		const target = event.target;
		if (!(target instanceof Node)) {
			closeAllMenus();
			return;
		}

		const clickedInsideProfile = profileMenus.some((menu) => menu.contains(target));
		const clickedInsideNotif = notificationMenus.some((menu) => menu.contains(target));
		if (!clickedInsideProfile && !clickedInsideNotif) {
			closeAllMenus();
		}
	});

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			closeAllMenus();
		}
	});

	if (!loadNotifications().length) {
		addNotification("New Suggestions", "Two new suggestions were received in the inbox.", false);
		addNotification("Reminder", "Review pending low-confidence items before publishing.", false);
	}

	if (window.CampusVoiceAdminState) {
		let lastSuggestionCount = Number(window.localStorage.getItem("campusvoice-last-suggestion-count") || "0");

		window.CampusVoiceAdminState.subscribe((state, meta) => {
			const currentCount = Array.isArray(state.suggestions) ? state.suggestions.length : 0;
			if (!lastSuggestionCount) {
				lastSuggestionCount = currentCount;
			}

			if (currentCount > lastSuggestionCount) {
				const newCount = currentCount - lastSuggestionCount;
				addNotification(
					"New Suggestions",
					`${newCount} new suggestion${newCount > 1 ? "s" : ""} just arrived.`,
					meta?.source !== "init"
				);
			}

			if (meta?.source === "reports-generate") {
				addNotification("Report Generated", "A new report was generated and added to history.", true);
			}

			if (meta?.source === "ai-review-apply") {
				addNotification("Review Updated", "A low-confidence suggestion has been resolved.", true);
			}

			if ((state.reviewQueue || []).length > 0 && meta?.source === "public-stats-publish") {
				addNotification("Reminder", "There are pending review items in the AI queue.", true);
			}

			lastSuggestionCount = currentCount;
			window.localStorage.setItem("campusvoice-last-suggestion-count", String(currentCount));
			renderNotifications();
		});
	}

	renderNotifications();
})();
