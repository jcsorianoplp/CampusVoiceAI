const generatedSlug = document.getElementById("generatedSlug");
const previewSlug = document.getElementById("previewSlug");
const previewSlugMirror = document.getElementById("previewSlugMirror");
const regenerateLinkButton = document.getElementById("regenerateLink");
const copyGeneratedLinkButton = document.getElementById("copyGeneratedLink");
const linkFeedback = document.getElementById("linkFeedback");
const publicPreviewCard = document.getElementById("publicPreviewCard");
const previewAccentButtons = Array.from(document.querySelectorAll("[data-preview-accent]"));
const overviewSnapshotList = document.getElementById("overviewSnapshotList");

const dashboardTotalSuggestions = document.getElementById("dashboardTotalSuggestions");
const dashboardTopCategory = document.getElementById("dashboardTopCategory");
const dashboardResponseRate = document.getElementById("dashboardResponseRate");
const dashboardAiAccuracy = document.getElementById("dashboardAiAccuracy");

const previewAccentThemes = {
	ocean: {
		accent: "#2d61d8",
		soft: "#e8f0ff"
	},
	mint: {
		accent: "#1a9b5b",
		soft: "#e3f8ec"
	},
	amber: {
		accent: "#c47a10",
		soft: "#fff2df"
	}
};

const slugSeeds = [
	"computer-society",
	"student-affairs",
	"campus-safety",
	"events-board",
	"academic-help",
	"org-feedback"
];

function createRandomSlug() {
	const base = slugSeeds[Math.floor(Math.random() * slugSeeds.length)];
	const suffix = Math.random().toString(36).slice(2, 6);
	return `${base}-${suffix}`;
}

function setGeneratedLink(slug, shouldPersist) {
	if (generatedSlug) {
		generatedSlug.value = slug;
	}

	if (previewSlug) {
		previewSlug.textContent = slug;
	}

	if (previewSlugMirror) {
		previewSlugMirror.textContent = `campusvoice.ai/${slug}`;
	}

	if (shouldPersist && window.CampusVoiceAdminState) {
		window.CampusVoiceAdminState.updateState({ generatedSlug: slug }, "dashboard-link");
	}
}

function setPreviewAccent(themeName, shouldPersist) {
	const theme = previewAccentThemes[themeName] || previewAccentThemes.ocean;

	if (publicPreviewCard) {
		publicPreviewCard.style.setProperty("--preview-accent", theme.accent);
		publicPreviewCard.style.setProperty("--preview-accent-soft", theme.soft);
	}

	previewAccentButtons.forEach((button) => {
		button.classList.toggle("is-active", button.dataset.previewAccent === themeName);
	});

	if (shouldPersist && window.CampusVoiceAdminState) {
		window.CampusVoiceAdminState.updateState({ previewAccent: themeName }, "dashboard-accent");
	}
}

async function copyTextToClipboard(text) {
	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return;
	}

	const tempInput = document.createElement("input");
	tempInput.value = text;
	document.body.appendChild(tempInput);
	tempInput.select();
	document.execCommand("copy");
	tempInput.remove();
}

function getCategoryTotals(categories, suggestions) {
	const categoryMap = new Map();

	categories.forEach((category) => {
		categoryMap.set(category.name, {
			name: category.name,
			volume: category.volume || 0,
			confidence: category.confidence || 0
		});
	});

	suggestions.forEach((suggestion) => {
		const entry = categoryMap.get(suggestion.category) || {
			name: suggestion.category,
			volume: 0,
			confidence: 0
		};
		entry.volume += 1;
		categoryMap.set(suggestion.category, entry);
	});

	return Array.from(categoryMap.values()).sort((left, right) => right.volume - left.volume);
}

function renderOverviewSnapshot(state) {
	if (!overviewSnapshotList) {
		return;
	}

	const recentRecords = state.suggestions.slice(0, 3);
	overviewSnapshotList.innerHTML = recentRecords
		.map((record) => `
			<article class="admin-snapshot-item">
				<div class="admin-snapshot-top">
					<span>${record.time}</span>
					<span class="admin-suggestion-category">#${record.category}</span>
				</div>
				<p>${record.text}</p>
				<div class="admin-snapshot-bottom">
					<span class="status-pill status-pill--${record.status}">${record.statusLabel}</span>
					<span class="admin-suggestion-sentiment admin-suggestion-sentiment--${record.sentiment.toLowerCase()}">${record.sentiment}</span>
				</div>
			</article>
		`)
		.join("");
}

function renderDashboardStats(state) {
	if (dashboardTotalSuggestions) {
		dashboardTotalSuggestions.textContent = String(state.suggestions.length);
	}

	const totals = getCategoryTotals(state.categories, state.suggestions);
	const topCategory = totals[0];

	if (dashboardTopCategory) {
		dashboardTopCategory.textContent = topCategory ? topCategory.name.replace(/^Campus\s+/i, "") : "No data";
	}

	if (dashboardResponseRate) {
		const resolvedCount = state.suggestions.filter((suggestion) => suggestion.status === "resolved").length;
		const responseRate = state.suggestions.length ? Math.round((resolvedCount / state.suggestions.length) * 100) : 0;
		dashboardResponseRate.textContent = `${responseRate}%`;
	}

	if (dashboardAiAccuracy) {
		const averageConfidence = state.categories.length
			? Math.round(state.categories.reduce((sum, category) => sum + (category.confidence || 0), 0) / state.categories.length)
			: 0;
		dashboardAiAccuracy.textContent = `${averageConfidence}%`;
	}
}

function syncFromState(state) {
	if (generatedSlug) {
		generatedSlug.value = state.generatedSlug;
	}

	if (previewSlug) {
		previewSlug.textContent = state.generatedSlug;
	}

	if (previewSlugMirror) {
		previewSlugMirror.textContent = `campusvoice.ai/${state.generatedSlug}`;
	}

	setPreviewAccent(state.previewAccent || "ocean", false);
	renderOverviewSnapshot(state);
	renderDashboardStats(state);
}

if (window.CampusVoiceAdminState) {
	window.CampusVoiceAdminState.subscribe((state, meta) => {
		syncFromState(state);
		if (linkFeedback && meta.source && meta.source !== "init") {
			linkFeedback.textContent = `Live sync from ${meta.source.replace(/-/g, " ")}.`;
		}
	});
}

if (previewAccentButtons.length > 0) {
	previewAccentButtons.forEach((button) => {
		button.addEventListener("click", () => {
			setPreviewAccent(button.dataset.previewAccent, true);
		});
	});
}

if (regenerateLinkButton && generatedSlug) {
	regenerateLinkButton.addEventListener("click", () => {
		setGeneratedLink(createRandomSlug(), true);
		if (linkFeedback) {
			linkFeedback.textContent = "New link generated and synced.";
		}
	});
}

if (copyGeneratedLinkButton && generatedSlug) {
	copyGeneratedLinkButton.addEventListener("click", async () => {
		const value = `campusvoice.ai/${generatedSlug.value}`;
		try {
			await copyTextToClipboard(value);
			if (linkFeedback) {
				linkFeedback.textContent = "Link copied to clipboard.";
			}
		} catch (error) {
			if (linkFeedback) {
				linkFeedback.textContent = "Copy failed. Please copy manually.";
			}
		}
	});
}

if (window.CampusVoiceAdminState) {
	const initialState = window.CampusVoiceAdminState.getState();
	setGeneratedLink(initialState.generatedSlug, false);
	renderOverviewSnapshot(initialState);
	renderDashboardStats(initialState);
	setPreviewAccent(initialState.previewAccent || "ocean", false);
}
