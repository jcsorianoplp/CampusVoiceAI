const tabButtons = Array.from(document.querySelectorAll("[data-tab-target]"));
const tabPanels = Array.from(document.querySelectorAll("[data-panel]"));
const suggestionInput = document.getElementById("suggestion");
const charCount = document.getElementById("charCount");
const suggestionForm = document.getElementById("suggestionForm");
const impactLevelInput = document.getElementById("impactLevel");
const locationTagInput = document.getElementById("locationTag");
const suggestedSolutionInput = document.getElementById("suggestedSolution");
const submitFeedback = document.getElementById("submitFeedback");
const backToAdminButton = document.getElementById("backToAdminButton");
const publicTotalValue = document.getElementById("publicTotalValue");
const publicTopCategoryValue = document.getElementById("publicTopCategoryValue");
const publicResolutionValue = document.getElementById("publicResolutionValue");
const publicTrendChart = document.getElementById("publicTrendChart");
const publicActivityFeed = document.getElementById("publicActivityFeed");
const publicAiIntegrationList = document.getElementById("publicAiIntegrationList");

const brandTextNodes = Array.from(document.querySelectorAll(".wireframe-brand-text"));
const headlineStrongNodes = Array.from(document.querySelectorAll(".wireframe-headline strong"));

function syncOrganizationCopy(state) {
	const organizationName = String(state?.organizationName || "Computer Society").trim() || "Computer Society";
	const headlineParts = organizationName.toUpperCase().split(/\s+/).filter(Boolean);

	brandTextNodes.forEach((node) => {
		node.textContent = organizationName;
	});

	headlineStrongNodes.forEach((node, index) => {
		node.textContent = headlineParts[index % Math.max(1, headlineParts.length)] || organizationName.toUpperCase();
	});
}

let activeTab = tabButtons.find((button) => button.classList.contains("is-active"))?.dataset.tabTarget || tabButtons[0]?.dataset.tabTarget || "suggestions";
let transitionToken = 0;

function createTrackingId() {
	const stamp = Date.now().toString(36).slice(-5).toUpperCase();
	const random = Math.random().toString(36).slice(2, 6).toUpperCase();
	return `CV-${stamp}${random}`;
}

function getCategoryTotals(state) {
	const categoryMap = new Map();

	// Add all defined categories from state first (with 0 volume)
	(state?.categories || []).forEach((category) => {
		categoryMap.set(category.name, { name: category.name, volume: 0 });
	});

	// Then update with actual suggestion counts
	(state?.suggestions || []).forEach((suggestion) => {
		const categoryName = suggestion.category;
		const current = categoryMap.get(categoryName) || { name: categoryName, volume: 0 };
		current.volume += 1;
		categoryMap.set(categoryName, current);
	});

	return Array.from(categoryMap.values()).sort((left, right) => right.volume - left.volume);
}

function getResponseRate(state) {
	const total = (state?.suggestions || []).length;
	if (!total) {
		return 0;
	}

	const resolvedCount = state.suggestions.filter((suggestion) => suggestion.status === "resolved").length;
	return Math.round((resolvedCount / total) * 100);
}

function normalizeImpactLevel(value) {
	const level = String(value || "medium").trim().toLowerCase();
	if (level === "high") {
		return "high";
	}

	if (level === "low") {
		return "low";
	}

	return "medium";
}

function getPublicRef() {
	const url = new URL(window.location.href);
	const queryRef = String(url.searchParams.get("ref") || url.searchParams.get("slug") || "").trim();
	if (queryRef) {
		return queryRef;
	}

	const pathParts = window.location.pathname.split("/").filter(Boolean);
	if (!pathParts.length) {
		return "";
	}

	if (pathParts[0] === "public" && pathParts[1]) {
		return decodeURIComponent(pathParts[1]);
	}

	return decodeURIComponent(pathParts[pathParts.length - 1] || "");
}

function isDesktopMode() {
	return Boolean(window.campusVoiceDesktop?.saveAppState);
}

async function loadBrowserPublicState() {
	if (!window.CampusVoiceAdminState || isDesktopMode()) {
		return;
	}

	const ref = getPublicRef();
	if (!ref) {
		return;
	}

	try {
		const response = await fetch(`/api/public-state?ref=${encodeURIComponent(ref)}`);
		const data = await response.json();
		if (data?.ok && data.state) {
			window.CampusVoiceAdminState.setLocalState(data.state, "public-browser-load");
		}
	} catch (error) {
		if (submitFeedback) {
			submitFeedback.textContent = "Unable to load the local public page.";
		}
	}
}

async function submitBrowserSuggestion(payload) {
	const ref = getPublicRef();
	const response = await fetch("/api/public-submit", {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			ref,
			...payload
		})
	});

	return response.json();
}



function renderPublicPanel(state) {
	if (!state) {
		return;
	}

	const categories = getCategoryTotals(state);
	const topCategory = categories[0]?.name || "No data";
	const totalVolume = categories.reduce((sum, item) => sum + item.volume, 0) || 1;
	const responseRate = getResponseRate(state);

	if (publicTotalValue) {
		publicTotalValue.textContent = String((state.suggestions || []).length);
	}

	if (publicTopCategoryValue) {
		publicTopCategoryValue.textContent = topCategory.replace(/^Campus\s+/i, "");
	}

	if (publicResolutionValue) {
		publicResolutionValue.textContent = `${responseRate}%`;
	}

	if (publicTrendChart) {
		publicTrendChart.innerHTML = categories.length
			? categories.map((item, index) => {
				const width = Math.max(8, Math.round((item.volume / totalVolume) * 100));
				const palette = ["#4fd12f", "#39a5be", "#b030b6", "#2d6ed8", "#ff8a1e", "#dfdfdf"];
				const label = item.name.replace(/^Campus\s+/i, "");
				return `
					<div class="public-bar-group">
						<span>${label}</span>
						<div class="public-bar" style="width:${width}%; background:${palette[index % palette.length]};"></div>
					</div>
				`;
			}).join("")
			: '<div class="public-feed-empty">No public activity yet.</div>';
	}

	if (publicAiIntegrationList) {
		const activeCatCount = (state?.categories || []).filter((c) => c.name !== "Uncategorized").length;
		const totalSuggestions = (state?.suggestions || []).length;
		const reviewQueueCount = (state?.reviewQueue || []).length;
		const classifierReady = activeCatCount > 0;

		publicAiIntegrationList.className = "public-ai-list";
		publicAiIntegrationList.innerHTML = `
			<article class="public-ai-item">
				<div class="public-ai-item-title">AI Classifier Status</div>
				<div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
					<div style="flex: 1; height: 24px; background: #e8f4f8; border-radius: 4px; overflow: hidden;">
						<div style="height: 100%; background: ${classifierReady ? "#4fd12f" : "#dfdfdf"}; width: ${classifierReady ? "100" : "30"}%; transition: width 0.3s ease;"></div>
					</div>
					<span style="font-size: 0.85rem; color: #4d9fc0; font-weight: 600;">${classifierReady ? "Active" : "Ready"}</span>
				</div>
				<div style="font-size: 0.8rem; color: #666; margin-top: 6px;">
					${activeCatCount} categories • ${totalSuggestions} submissions • ${reviewQueueCount} pending review
				</div>
			</article>
		`;
	}

	if (publicActivityFeed) {
		const feedItems = Array.isArray(state.publicFeed) ? state.publicFeed : [];
		publicActivityFeed.innerHTML = feedItems.length
			? feedItems.slice(0, 4).map((item) => `
				<article class="public-feed-item">
					<div class="public-feed-top"><span>${item.time}</span><span>#${item.category}</span></div>
					<p>${item.text}</p>
					<div class="public-feed-bottom"><span class="status-pill status-pill--${item.status}">${item.statusLabel}</span><span>Public</span></div>
				</article>
			`).join("")
			: '<div class="public-feed-empty">No public updates yet.</div>';
	}
}

function activateTab(targetTab, animate = true) {
	const nextTab = targetTab === "public" ? "public" : "suggestions";
	if (nextTab === activeTab) {
		return;
	}

	transitionToken += 1;
	const localToken = transitionToken;

	const currentPanel = tabPanels.find((panel) => panel.dataset.panel === activeTab);
	const nextPanel = tabPanels.find((panel) => panel.dataset.panel === nextTab);
	const movingForward = activeTab === "suggestions" && nextTab === "public";

	activeTab = nextTab;

	tabPanels.forEach((panel) => {
		panel.classList.remove(
			"is-entering-from-left",
			"is-entering-from-right",
			"is-leaving-to-left",
			"is-leaving-to-right"
		);
	});

	if (currentPanel) {
		currentPanel.classList.remove("is-visible");
		if (animate) {
			currentPanel.classList.add(movingForward ? "is-leaving-to-left" : "is-leaving-to-right");
		}
	}

	if (nextPanel) {
		nextPanel.hidden = false;
		nextPanel.classList.remove("is-visible");

		if (animate) {
			nextPanel.classList.add(movingForward ? "is-entering-from-right" : "is-entering-from-left");
		}

		requestAnimationFrame(() => {
			if (localToken !== transitionToken) {
				return;
			}
			nextPanel.classList.add("is-visible");
			if (animate) {
				nextPanel.classList.remove("is-entering-from-right", "is-entering-from-left");
			}
		});
	}

	window.setTimeout(() => {
		if (localToken !== transitionToken) {
			return;
		}

		tabPanels.forEach((panel) => {
			const isCurrent = panel.dataset.panel === activeTab;
			panel.hidden = !isCurrent;
			panel.classList.remove("is-leaving-to-left", "is-leaving-to-right", "is-entering-from-left", "is-entering-from-right");
			if (isCurrent) {
				panel.classList.add("is-visible");
			} else {
				panel.classList.remove("is-visible");
			}
		});
	}, animate ? 430 : 0);

	tabButtons.forEach((button) => {
		const isActive = button.dataset.tabTarget === nextTab;
		button.classList.toggle("is-active", isActive);
		button.setAttribute("aria-selected", String(isActive));
	});

}

tabButtons.forEach((button) => {
	button.addEventListener("click", () => {
		activateTab(button.dataset.tabTarget);
	});
});

if (tabButtons.length > 0) {
	const initialTab = tabButtons.find((button) => button.classList.contains("is-active"))?.dataset.tabTarget || tabButtons[0].dataset.tabTarget;
	activeTab = initialTab;
	tabPanels.forEach((panel) => {
		panel.hidden = panel.dataset.panel !== initialTab;
		panel.classList.toggle("is-visible", panel.dataset.panel === initialTab);
		panel.classList.remove("is-entering-from-left", "is-entering-from-right", "is-leaving-to-left", "is-leaving-to-right");
	});
	tabButtons.forEach((button) => {
		const isActive = button.dataset.tabTarget === initialTab;
		button.classList.toggle("is-active", isActive);
		button.setAttribute("aria-selected", String(isActive));
	});
}

if (suggestionInput && charCount) {
	const updateCount = () => {
		charCount.textContent = String(suggestionInput.value.length);
	};

	suggestionInput.addEventListener("input", updateCount);
	updateCount();
}

if (backToAdminButton) {
	if (!isDesktopMode()) {
		backToAdminButton.hidden = true;
	}

	backToAdminButton.addEventListener("click", () => {
		if (isDesktopMode()) {
			window.location.href = "../Admin/AdminDashboard.html";
		}
	});
}

if (suggestionForm && suggestionInput) {
	suggestionForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		const suggestionText = suggestionInput.value.trim();
		const impactLevel = normalizeImpactLevel(impactLevelInput?.value);
		const locationTag = locationTagInput?.value || "General";
		const suggestedSolution = suggestedSolutionInput?.value.trim() || "";
		const trackingId = createTrackingId();
		if (!suggestionText) {
			suggestionInput.focus();
			return;
		}

			if (submitFeedback) {
				submitFeedback.textContent = "Saving suggestion to the database...";
			}

		if (window.CampusVoiceAdminState) {
			if (!isDesktopMode()) {
				if (submitFeedback) {
					submitFeedback.textContent = "Saving suggestion to the local server...";
				}

				const saveResult = await submitBrowserSuggestion({
					trackingId,
					text: suggestionText,
					impactLevel,
					location: locationTag,
					suggestedSolution,
					sentiment: "Neutral"
				});

				if (!saveResult?.ok || !saveResult.state) {
					if (submitFeedback) {
						submitFeedback.textContent = `Database save failed: ${saveResult?.message || "Unknown error"}`;
					}
					return;
				}

				window.CampusVoiceAdminState.setLocalState(saveResult.state, "public-suggestion-submit");
			} else {
			// Do NOT infer category on the client; backend will categorize from DB rules.
			window.CampusVoiceAdminState.updateState((state) => {
				state.suggestions.unshift({
					time: "Just now",
					category: "Processing",
					status: "open",
					statusLabel: "Open",
					impactLevel,
					location: locationTag,
					suggestedSolution,
					trackingId,
					sentiment: "Neutral",
					text: suggestionText
				});

				state.lastUpdated = `Submitted: ${new Date().toLocaleString()}`;
				return state;
			}, "public-suggestion-submit");
			const saveResult = await window.CampusVoiceAdminState.flushPendingBackendSave?.();
			if (!saveResult?.ok) {
				if (submitFeedback) {
					submitFeedback.textContent = `Database save failed: ${saveResult?.message || "Unknown error"}`;
				}
				return;
			}
			}
		}

		suggestionInput.value = "";
		if (impactLevelInput) {
			impactLevelInput.value = "medium";
		}
		if (locationTagInput) {
			locationTagInput.value = "";
		}
		if (suggestedSolutionInput) {
			suggestedSolutionInput.value = "";
		}
		if (charCount) {
			charCount.textContent = "0";
		}
		if (submitFeedback) {
			submitFeedback.textContent = `Saved to database successfully. Tracking ID: ${trackingId}`;
		}

		activateTab("public");
	});
}

if (window.CampusVoiceAdminState) {
	window.CampusVoiceAdminState.subscribe((state) => {
		syncOrganizationCopy(state);
		renderPublicPanel(state);
	});
	const initialState = window.CampusVoiceAdminState.getState();
	syncOrganizationCopy(initialState);
	renderPublicPanel(initialState);
	loadBrowserPublicState();
}
