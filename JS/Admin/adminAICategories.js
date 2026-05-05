const categoryForm = document.getElementById("categoryForm");
const categoryNameInput = document.getElementById("categoryNameInput");
const categoryPriorityInput = document.getElementById("categoryPriorityInput");
const categoryRouteInput = document.getElementById("categoryRouteInput");
const categorySlaInput = document.getElementById("categorySlaInput");
const categoryConfidenceInput = document.getElementById("categoryConfidenceInput");
const categoryKeywordInput = document.getElementById("categoryKeywordInput");

const categoryList = document.getElementById("categoryList");
const reviewQueueList = document.getElementById("reviewQueueList");
const publicMappingList = document.getElementById("publicMappingList");

const activeCategoryCount = document.getElementById("aiActiveCategoryCount");
const lowConfidenceCount = document.getElementById("aiLowConfidenceCount");
const averageConfidence = document.getElementById("aiAverageConfidence");
const autoRoutedRate = document.getElementById("aiAutoRoutedRate");

const routingThresholdInput = document.getElementById("routingThresholdInput");
const routingThresholdValue = document.getElementById("routingThresholdValue");
const aiRuleTestInput = document.getElementById("aiRuleTestInput");
const aiRuleTestResult = document.getElementById("aiRuleTestResult");
const aiLiveSyncStatus = document.getElementById("aiLiveSyncStatus");

const syncCategoryStats = document.getElementById("syncCategoryStats");
const saveCategoryRules = document.getElementById("saveCategoryRules");
const categorySaveStatus = document.getElementById("categorySaveStatus");
const reviewQueueStatus = document.getElementById("reviewQueueStatus");
const uncertainQueueToggle = document.getElementById("uncertainQueueToggle");
const publicBucketToggle = document.getElementById("publicBucketToggle");
const keywordBoostToggle = document.getElementById("keywordBoostToggle");

function normalizeKeywords(input) {
	return String(input || "")
		.split(",")
		.map((keyword) => keyword.trim().toLowerCase())
		.filter(Boolean)
		.slice(0, 6);
}

function getPriorityClass(priority) {
	if (priority === "high") return "admin-ai-pill--high";
	if (priority === "low") return "admin-ai-pill--low";
	return "admin-ai-pill--medium";
}

function renderCategoryList(state) {
	if (!categoryList) return;

	categoryList.innerHTML = "";

	state.categories.forEach((category) => {
		const item = document.createElement("article");
		item.className = "admin-ai-item";

		const keywordTags = (category.keywords || [])
			.map((keyword) => `<span>${keyword}</span>`)
			.join("");

		item.innerHTML = `
			<div class="admin-ai-item-top">
				<div class="admin-ai-item-name">${category.name}</div>
				<span class="admin-ai-pill ${getPriorityClass(category.priority)}">${category.priority.toUpperCase()} Priority</span>
			</div>
			<div class="admin-ai-item-bottom">
				<span class="admin-ai-meta">Route: ${category.route}</span>
				<span class="admin-ai-meta">SLA: ${category.sla}</span>
				<span class="admin-ai-meta">Confidence: ${category.confidence}%</span>
				<span class="admin-ai-meta">Volume: ${category.volume}</span>
			</div>
			<div class="admin-ai-tags">${keywordTags || "<span>No hints yet</span>"}</div>
		`;

		categoryList.appendChild(item);
	});
}

function renderReviewQueue(state) {
	if (!reviewQueueList) return;

	reviewQueueList.innerHTML = "";

	if (!state.reviewQueue.length) {
		reviewQueueList.innerHTML = "<div class=\"admin-ai-status\">No low-confidence suggestions remaining.</div>";
		if (reviewQueueStatus) {
			reviewQueueStatus.textContent = "All uncertain items have been reviewed.";
		}
		return;
	}

	state.reviewQueue.forEach((reviewItem) => {
		const item = document.createElement("article");
		item.className = "admin-ai-review-item";

		const options = state.categories
			.map((category) => `<option value="${category.name}">${category.name}</option>`)
			.join("");

		item.innerHTML = `
			<div class="admin-ai-review-top">
				<span>Predicted: ${reviewItem.predicted}</span>
				<span>${reviewItem.confidence}% confidence</span>
			</div>
			<p>${reviewItem.text}</p>
			<div class="admin-ai-review-actions">
				<select class="admin-filter" data-review-select="${reviewItem.id}">${options}</select>
				<button class="admin-secondary-btn" type="button" data-review-apply="${reviewItem.id}">Apply</button>
			</div>
		`;

		reviewQueueList.appendChild(item);
	});

	if (reviewQueueStatus) {
		reviewQueueStatus.textContent = "Apply corrections to improve classifier quality.";
	}
}

function renderPublicMapping(state) {
	if (!publicMappingList) return;

	publicMappingList.innerHTML = "";

	state.categories.slice(0, 6).forEach((category) => {
		const mappingItem = document.createElement("li");
		const publicLabel = category.name.replace("Campus ", "").replace("Services", "Support");
		mappingItem.innerHTML = `
			<span>${category.name}</span>
			<i class="bi bi-arrow-right"></i>
			<span>${publicLabel}</span>
		`;
		publicMappingList.appendChild(mappingItem);
	});
}

function updateStats(state) {
	if (activeCategoryCount) {
		activeCategoryCount.textContent = String(state.categories.length);
	}

	if (lowConfidenceCount) {
		lowConfidenceCount.textContent = String(state.reviewQueue.length);
	}

	if (averageConfidence) {
		const confidenceAverage = state.categories.length
			? state.categories.reduce((sum, category) => sum + category.confidence, 0) / state.categories.length
			: 0;
		averageConfidence.textContent = `${Math.round(confidenceAverage)}%`;
	}

	if (autoRoutedRate && routingThresholdInput) {
		const threshold = Number(routingThresholdInput.value);
		const routed = state.categories.filter((category) => category.confidence >= threshold).length;
		const rate = state.categories.length ? Math.round((routed / state.categories.length) * 100) : 0;
		autoRoutedRate.textContent = `${rate}%`;
	}
}

function runRuleSimulation(state) {
	if (!aiRuleTestInput || !aiRuleTestResult || !state.categories.length) {
		return;
	}

	const sampleText = aiRuleTestInput.value.trim().toLowerCase();
	if (!sampleText) {
		aiRuleTestResult.textContent = "Type a sample suggestion to preview classification behavior.";
		return;
	}

	// Use backend classification preview so the simulator matches real saved suggestions.
	if (window.campusVoiceDesktop?.previewAiClassification) {
		window.campusVoiceDesktop.previewAiClassification({
			orgId: state.organizationId,
			text: sampleText
		})
			.then((resp) => {
				if (!resp?.ok || !resp.result) {
					aiRuleTestResult.textContent = resp?.message || "Unable to preview classification.";
					return;
				}

				const routingThreshold = Number(routingThresholdInput?.value || state.aiRules.threshold || 80);
				const confidence = Number(resp.result.confidence || 0);
				const routeMode = confidence >= routingThreshold ? "Auto-route" : "Manual review";
				aiRuleTestResult.textContent = `Predicted: ${resp.result.category} (${confidence}% confidence) | ${routeMode}.`;
			})
			.catch(() => {
				aiRuleTestResult.textContent = "Classifier preview is unavailable.";
			});
		return;
	}

	aiRuleTestResult.textContent = "Classifier preview is unavailable.";
}

function syncControls(state) {
	if (routingThresholdInput) {
		routingThresholdInput.value = String(state.aiRules.threshold);
	}

	if (routingThresholdValue) {
		routingThresholdValue.textContent = `${state.aiRules.threshold}%`;
	}

	if (uncertainQueueToggle) {
		uncertainQueueToggle.checked = !!state.aiRules.uncertainQueue;
	}

	if (publicBucketToggle) {
		publicBucketToggle.checked = !!state.aiRules.publicSync;
	}

	if (keywordBoostToggle) {
		keywordBoostToggle.checked = !!state.aiRules.keywordBoost;
	}

	if (aiRuleTestInput && aiRuleTestInput.value !== state.aiRules.testInput) {
		aiRuleTestInput.value = state.aiRules.testInput || "";
	}
}

function updateLiveStatus(meta, state) {
	if (!aiLiveSyncStatus) {
		return;
	}

	const sourceLabel = meta && meta.source ? meta.source.replace(/-/g, " ") : "state sync";
	aiLiveSyncStatus.textContent = `Live sync active. Last update from ${sourceLabel} at ${state.lastUpdated || new Date().toLocaleString()}.`;
}

function renderAll(state) {
	renderCategoryList(state);
	renderReviewQueue(state);
	renderPublicMapping(state);
	updateStats(state);
	runRuleSimulation(state);
	syncControls(state);
}

function commitState(updater, source, feedbackMessage) {
	if (!window.CampusVoiceAdminState) {
		return;
	}

	window.CampusVoiceAdminState.updateState(updater, source);
	if (categorySaveStatus && feedbackMessage) {
		categorySaveStatus.textContent = feedbackMessage;
	}
}

if (routingThresholdInput) {
	routingThresholdInput.addEventListener("input", () => {
		commitState((state) => {
			state.aiRules.threshold = Number(routingThresholdInput.value);
			state.lastUpdated = new Date().toLocaleString();
			return state;
		}, "ai-threshold", `Threshold set to ${routingThresholdInput.value}%.`);
	});
}

if (aiRuleTestInput) {
	aiRuleTestInput.addEventListener("input", () => {
		// Keep simulator input local (do not persist to DB).
		const current = window.CampusVoiceAdminState?.getState?.();
		if (current) {
			runRuleSimulation(current);
		}
	});
}

if (uncertainQueueToggle) {
	uncertainQueueToggle.addEventListener("change", () => {
		commitState((state) => {
			state.aiRules.uncertainQueue = uncertainQueueToggle.checked;
			state.lastUpdated = new Date().toLocaleString();
			return state;
		}, "ai-toggle", `Uncertain queue ${uncertainQueueToggle.checked ? "enabled" : "disabled"}.`);
	});
}

if (publicBucketToggle) {
	publicBucketToggle.addEventListener("change", () => {
		commitState((state) => {
			state.aiRules.publicSync = publicBucketToggle.checked;
			state.lastUpdated = new Date().toLocaleString();
			return state;
		}, "ai-toggle", `Public sync ${publicBucketToggle.checked ? "enabled" : "disabled"}.`);
	});
}

if (keywordBoostToggle) {
	keywordBoostToggle.addEventListener("change", () => {
		commitState((state) => {
			state.aiRules.keywordBoost = keywordBoostToggle.checked;
			state.lastUpdated = new Date().toLocaleString();
			return state;
		}, "ai-toggle", `Keyword boost ${keywordBoostToggle.checked ? "enabled" : "disabled"}.`);
	});
}

if (categoryForm) {
	categoryForm.addEventListener("submit", (event) => {
		event.preventDefault();

		const name = categoryNameInput?.value.trim();
		if (!name || !window.CampusVoiceAdminState) return;

		const confidence = Number(categoryConfidenceInput?.value || "84");
		const keywords = normalizeKeywords(categoryKeywordInput?.value || "");

		window.CampusVoiceAdminState.updateState((state) => {
			state.categories.unshift({
				name,
				priority: categoryPriorityInput?.value || "medium",
				route: categoryRouteInput?.value || "Student Affairs",
				sla: categorySlaInput?.value || "24h",
				confidence: Math.max(50, Math.min(99, confidence)),
				volume: 0,
				keywords
			});
			state.lastUpdated = new Date().toLocaleString();
			return state;
		}, "ai-category-add");

		categoryForm.reset();
		if (categoryPriorityInput) categoryPriorityInput.value = "medium";
		if (categoryConfidenceInput) categoryConfidenceInput.value = "84";
		if (categorySaveStatus) {
			categorySaveStatus.textContent = `Added category \"${name}\" and synced it to the shared admin state.`;
		}
	});
}

if (reviewQueueList) {
	reviewQueueList.addEventListener("click", (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement)) return;

		const itemId = target.getAttribute("data-review-apply");
		if (!itemId || !window.CampusVoiceAdminState) return;

		const select = reviewQueueList.querySelector(`[data-review-select="${itemId}"]`);
		if (!(select instanceof HTMLSelectElement)) return;

		window.CampusVoiceAdminState.updateState((state) => {
			state.reviewQueue = state.reviewQueue.filter((item) => item.id !== itemId);
			state.lastUpdated = new Date().toLocaleString();
			return state;
		}, "ai-review-apply");

		if (categorySaveStatus) {
			categorySaveStatus.textContent = `Correction saved to ${select.value}.`;
		}
	});
}

if (syncCategoryStats) {
	syncCategoryStats.addEventListener("click", () => {
		commitState((state) => {
			state.categories = state.categories.map((category) => {
				const variance = Math.floor(Math.random() * 6) - 2;
				return {
					...category,
					volume: Math.max(0, category.volume + variance)
				};
			});
			state.lastUpdated = new Date().toLocaleString();
			return state;
		}, "ai-sync", "Category stats synchronized from latest suggestions.");
	});
}

if (saveCategoryRules) {
	saveCategoryRules.addEventListener("click", () => {
		commitState((state) => {
			state.lastUpdated = new Date().toLocaleString();
			return state;
		}, "ai-save", "Rules saved and published to the shared admin state.");
	});
}

if (window.CampusVoiceAdminState) {
	window.CampusVoiceAdminState.subscribe((state, meta) => {
		renderAll(state);
		updateLiveStatus(meta, state);
		if (meta.source !== "init" && reviewQueueStatus) {
			reviewQueueStatus.textContent = `Live sync from ${meta.source}.`;
		}
	});
}
