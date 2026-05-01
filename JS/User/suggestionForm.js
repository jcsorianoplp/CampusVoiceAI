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

	(state?.suggestions || []).forEach((suggestion) => {
		const current = categoryMap.get(suggestion.category) || { name: suggestion.category, volume: 0 };
		current.volume += 1;
		categoryMap.set(suggestion.category, current);
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

function fitPublicMetricText(element) {
	if (!element) {
		return;
	}

	element.style.fontSize = "";
	const computed = window.getComputedStyle(element);
	const baseFontSize = Number.parseFloat(computed.fontSize || "0") || 16;
	const minFontSize = 11;
	let fontSize = baseFontSize;

	while (fontSize >= minFontSize) {
		element.style.fontSize = `${fontSize}px`;
		if (element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight) {
			return;
		}
		fontSize -= 1;
	}

	element.style.fontSize = `${minFontSize}px`;
}

function inferCategory(text) {
	const lower = String(text || "").toLowerCase();
	const rules = [
		{ label: "Campus Safety", terms: ["safe", "safety", "security", "gate", "crowd", "incident"] },
		{ label: "Academic Services", terms: ["grading", "grade", "schedule", "exam", "professor", "classroom", "projector", "lecture"] },
		{ label: "Campus Facilities", terms: ["aircon", "air conditioning", "light", "lights", "wifi", "room", "building", "library", "chair", "canteen"] },
		{ label: "Student Life", terms: ["club", "org", "organization", "event", "events", "activity", "student"] },
		{ label: "Admin Process", terms: ["enroll", "registration", "process", "form", "checklist", "admission"] }
	];

	const foundRule = rules.find((rule) => rule.terms.some((term) => lower.includes(term)));
	return foundRule ? foundRule.label : "Campus Facilities";
}

function inferSentiment(text) {
	const lower = String(text || "").toLowerCase();
	if (/(thank|great|good|love|helpful|better)/.test(lower)) {
		return "Positive";
	}

	if (/(issue|bad|slow|problem|hard|confusing|unsafe|crowded|weak|late)/.test(lower)) {
		return "Negative";
	}

	return "Neutral";
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

function buildPublicFeedEntry(text, category) {
	return {
		time: "Just now",
		category,
		status: "open",
		statusLabel: "Open",
		text: `New suggestion submitted: ${text.length > 92 ? `${text.slice(0, 89)}...` : text}`
	};
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
		window.requestAnimationFrame(() => fitPublicMetricText(publicTopCategoryValue));
	}

	if (publicResolutionValue) {
		publicResolutionValue.textContent = `${responseRate}%`;
	}

	if (publicTrendChart) {
		publicTrendChart.innerHTML = categories.length
			? categories.slice(0, 6).map((item, index) => {
				const height = Math.max(24, Math.round((item.volume / totalVolume) * 160));
				const palette = ["#4fd12f", "#39a5be", "#b030b6", "#2d6ed8", "#ff8a1e", "#dfdfdf"];
				const label = item.name.replace(/^Campus\s+/i, "");
				return `
					<div class="public-bar-group">
						<div class="public-bar" style="height:${height}px; background:${palette[index % palette.length]};"></div>
						<span>${label}</span>
					</div>
				`;
			}).join("")
			: '<div class="public-feed-empty">No public activity yet.</div>';
	}

	if (publicAiIntegrationList) {
		const aiInsights = Array.isArray(state.aiInsights) ? state.aiInsights : [];

		if (!aiInsights.length) {
			publicAiIntegrationList.className = "public-ai-empty";
			publicAiIntegrationList.textContent = "No AI integration data yet. Connect a model, rule engine, or live feed here later.";
		} else {
			publicAiIntegrationList.className = "public-ai-list";
			publicAiIntegrationList.innerHTML = aiInsights.slice(0, 4).map((item) => {
				const title = String(item.title || item.label || item.name || "AI Insight");
				const summary = String(item.summary || item.detail || item.value || "Live AI output will appear here.");
				return `
					<article class="public-ai-item">
						<div class="public-ai-item-title">${title}</div>
						<div class="public-ai-item-copy">${summary}</div>
					</article>
				`;
			}).join("");
		}
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
	backToAdminButton.addEventListener("click", () => {
		window.location.href = "../Admin/AdminDashboard.html";
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
			const category = inferCategory(suggestionText);
			const sentiment = inferSentiment(suggestionText);
			const nextFeedEntry = buildPublicFeedEntry(suggestionText, category);
			window.CampusVoiceAdminState.updateState((state) => {
				state.suggestions.unshift({
					time: "Just now",
					category,
					status: "open",
					statusLabel: "Open",
					impactLevel,
					location: locationTag,
					suggestedSolution,
					trackingId,
					sentiment,
					text: suggestionText
				});

				state.publicFeed.unshift(nextFeedEntry);
				state.publicFeed = state.publicFeed.slice(0, 10);
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
}
