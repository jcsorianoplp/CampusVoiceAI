const rangeButtons = Array.from(document.querySelectorAll("[data-range]"));
const publicTrendChart = document.getElementById("publicTrendChart");
const noteInput = document.getElementById("publicSummaryNote");
const noteCount = document.getElementById("publicNoteCount");
const lastUpdated = document.getElementById("publicLastUpdated");
const publishButton = document.getElementById("publishPublicStats");
const refreshButton = document.getElementById("refreshPublicStats");

const totalValue = document.getElementById("publicTotalValue");
const resolutionValue = document.getElementById("publicResolutionValue");
const responseTimeValue = document.getElementById("publicResponseTimeValue");
const topCategoryValue = document.getElementById("publicTopCategoryValue");
const publicCategoryBreakdown = document.getElementById("publicCategoryBreakdown");
const publicActivityCard = document.getElementById("publicActivityCard");

const rangeData = {
	"7": {
		labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
		submissions: [52, 61, 44, 58, 66, 48, 56],
		resolved: [36, 41, 30, 39, 47, 34, 40]
	},
	"30": {
		labels: ["W1", "W2", "W3", "W4", "W5", "W6", "W7"],
		submissions: [38, 45, 55, 62, 58, 69, 74],
		resolved: [24, 28, 35, 42, 39, 48, 51]
	}
};

function renderTrendChart(data) {
	if (!publicTrendChart) {
		return;
	}

	const labels = data.labels || [];
	const submissions = data.submissions || [];
	const resolved = data.resolved || [];

	publicTrendChart.innerHTML = labels.map((label, index) => {
		const submissionValue = submissions[index] || 0;
		const resolvedValue = resolved[index] || 0;
		return `
			<div class="trend-group">
				<div class="trend-bars">
					<div class="trend-bar trend-bar--submission" title="${label} submissions: ${submissionValue}">
						<span class="trend-bar-value">${submissionValue}</span>
						<span class="trend-bar-fill" style="height:${submissionValue}%"></span>
					</div>
					<div class="trend-bar trend-bar--resolved" title="${label} resolved: ${resolvedValue}">
						<span class="trend-bar-value">${resolvedValue}</span>
						<span class="trend-bar-fill" style="height:${resolvedValue}%"></span>
					</div>
				</div>
				<div class="trend-label">${label}</div>
			</div>
		`;
	}).join("");
}

function getCategoryTotals(state) {
	const categoryMap = new Map();

	state.categories.forEach((category) => {
		categoryMap.set(category.name, {
			name: category.name,
			volume: category.volume || 0
		});
	});

	state.suggestions.forEach((suggestion) => {
		const current = categoryMap.get(suggestion.category) || {
			name: suggestion.category,
			volume: 0
		};
		current.volume += 1;
		categoryMap.set(suggestion.category, current);
	});

	return Array.from(categoryMap.values()).sort((left, right) => right.volume - left.volume);
}

function renderBreakdown(state) {
	if (!publicCategoryBreakdown) {
		return;
	}

	const totals = getCategoryTotals(state);
	const totalVolume = totals.reduce((sum, category) => sum + category.volume, 0) || 1;

	publicCategoryBreakdown.innerHTML = totals.slice(0, 5).map((category) => {
		const percentage = Math.round((category.volume / totalVolume) * 100);
		const label = category.name.replace(/^Campus\s+/i, "").replace(/Services$/i, "Support");
		return `<li><span>${label}</span><strong>${percentage}%</strong></li>`;
	}).join("");
}

function renderActivity(state) {
	if (!publicActivityCard) {
		return;
	}

	const feedContainer = publicActivityCard.querySelector(".admin-feed--public");
	if (!feedContainer) {
		return;
	}

	feedContainer.innerHTML = state.publicFeed.map((item) => `
		<article class="admin-feed-item">
			<div class="admin-feed-top"><span>${item.time}</span><span>#${item.category}</span></div>
			<p>${item.text}</p>
			<div class="admin-feed-bottom"><span class="status-pill status-pill--${item.status}">${item.statusLabel}</span><span>Public</span></div>
		</article>
	`).join("");
}

function applyRange(state, rangeKey) {
	const data = rangeData[rangeKey] || rangeData["7"];
	const totals = getCategoryTotals(state);
	const topCategory = totals[0];
	const resolvedCount = state.suggestions.filter((suggestion) => suggestion.status === "resolved").length;
	const responseAverage = state.categories.length
		? (state.categories.reduce((sum, category) => sum + category.confidence, 0) / state.categories.length)
		: 0;

	if (totalValue) totalValue.textContent = String(state.suggestions.length);
	if (resolutionValue) resolutionValue.textContent = `${Math.round((resolvedCount / Math.max(1, state.suggestions.length)) * 100)}%`;
	if (responseTimeValue) responseTimeValue.textContent = `${(Math.max(1.8, 4.5 - responseAverage / 40)).toFixed(1)}d`;
	if (topCategoryValue) topCategoryValue.textContent = topCategory ? topCategory.name.replace(/^Campus\s+/i, "") : "No data";

	renderTrendChart(data);

	rangeButtons.forEach((button) => {
		button.classList.toggle("is-active", button.dataset.range === rangeKey);
	});
}

function updateNoteCount() {
	if (!noteInput || !noteCount) {
		return;
	}

	noteCount.textContent = `${noteInput.value.length}/180`;
}

function updateTimestamp(label, text) {
	if (!lastUpdated) {
		return;
	}

	lastUpdated.textContent = `${label}: ${text || new Date().toLocaleString()}`;
}

function syncFromState(state) {
	if (noteInput && noteInput.value !== state.publicNote) {
		noteInput.value = state.publicNote || "";
		updateNoteCount();
	}

	const activeRange = state.publicRange || "7";
	applyRange(state, activeRange);
	renderBreakdown(state);
	renderActivity(state);
	updateTimestamp("Last updated", state.lastUpdated || "Not yet published");
}

rangeButtons.forEach((button) => {
	button.addEventListener("click", () => {
		if (window.CampusVoiceAdminState) {
			window.CampusVoiceAdminState.updateState({ publicRange: button.dataset.range }, "public-stats-range");
		}
	});
});

const widgetToggles = Array.from(document.querySelectorAll("[data-widget-toggle]"));
widgetToggles.forEach((toggle) => {
	toggle.addEventListener("change", () => {
		const target = document.querySelector(toggle.dataset.widgetToggle);
		if (!target) {
			return;
		}

		target.hidden = !toggle.checked;
	});
});

if (noteInput) {
	noteInput.addEventListener("input", () => {
		updateNoteCount();
		if (window.CampusVoiceAdminState) {
			window.CampusVoiceAdminState.updateState({ publicNote: noteInput.value }, "public-note");
		}
	});
	updateNoteCount();
}

if (refreshButton) {
	refreshButton.addEventListener("click", () => {
		if (window.CampusVoiceAdminState) {
			const state = window.CampusVoiceAdminState.getState();
			applyRange(state, state.publicRange || "7");
			renderBreakdown(state);
			renderActivity(state);
			updateTimestamp("Refreshed", new Date().toLocaleString());
			window.CampusVoiceAdminState.updateState({ lastUpdated: `Refreshed: ${new Date().toLocaleString()}` }, "public-stats-refresh");
		}
	});
}

if (publishButton) {
	publishButton.addEventListener("click", () => {
		if (window.CampusVoiceAdminState) {
			window.CampusVoiceAdminState.updateState({ lastUpdated: `Published: ${new Date().toLocaleString()}` }, "public-stats-publish");
		}
	});
}

if (window.CampusVoiceAdminState) {
	window.CampusVoiceAdminState.subscribe((state) => {
		syncFromState(state);
	});
}
