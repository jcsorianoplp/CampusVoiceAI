const tabButtons = Array.from(document.querySelectorAll("[data-tab-target]"));
const tabPanels = Array.from(document.querySelectorAll("[data-panel]"));
const suggestionInput = document.getElementById("suggestion");
const charCount = document.getElementById("charCount");
const suggestionForm = document.getElementById("suggestionForm");
const generatedSlug = document.getElementById("generatedSlug");
const previewSlug = document.getElementById("previewSlug");
const regenerateLinkButton = document.getElementById("regenerateLink");
const copyGeneratedLinkButton = document.getElementById("copyGeneratedLink");
const linkFeedback = document.getElementById("linkFeedback");
const adminNavButtons = Array.from(document.querySelectorAll("[data-admin-target]"));
const adminPanels = Array.from(document.querySelectorAll("[data-admin-panel]"));
const suggestionSearch = document.getElementById("suggestionSearch");
const categoryFilter = document.getElementById("categoryFilter");
const statusFilter = document.getElementById("statusFilter");
const suggestionBoard = document.getElementById("suggestionBoard");
const suggestionEmptyState = document.getElementById("suggestionEmptyState");
const viewToggleButtons = Array.from(document.querySelectorAll("[data-view-mode]"));

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

function setGeneratedLink(slug) {
	if (generatedSlug) {
		generatedSlug.value = slug;
	}

	if (previewSlug) {
		previewSlug.textContent = slug;
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

if (generatedSlug) {
	setGeneratedLink(createRandomSlug());
}

if (regenerateLinkButton && generatedSlug) {
	regenerateLinkButton.addEventListener("click", () => {
		const slug = createRandomSlug();
		setGeneratedLink(slug);
		if (linkFeedback) {
			linkFeedback.textContent = "New link generated.";
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

function setActiveTab(targetTab) {
	tabPanels.forEach((panel) => {
		panel.hidden = panel.dataset.panel !== targetTab;
	});

	tabButtons.forEach((button) => {
		const isActive = button.dataset.tabTarget === targetTab;
		button.classList.toggle("is-active", isActive);
		button.setAttribute("aria-selected", String(isActive));
	});
}

function setAdminPanel(targetPanel) {
	adminPanels.forEach((panel) => {
		const isActive = panel.dataset.adminPanel === targetPanel;
		panel.hidden = !isActive;
		panel.classList.toggle("is-active", isActive);
	});

	adminNavButtons.forEach((button) => {
		const isActive = button.dataset.adminTarget === targetPanel;
		button.classList.toggle("is-active", isActive);
	});
}

function updateSuggestionBoardVisibility() {
	if (!suggestionBoard) {
		return;
	}

	const searchValue = suggestionSearch ? suggestionSearch.value.trim().toLowerCase() : "";
	const categoryValue = categoryFilter ? categoryFilter.value : "all";
	const statusValue = statusFilter ? statusFilter.value : "all";
	let visibleCount = 0;

	Array.from(suggestionBoard.querySelectorAll("[data-category][data-status][data-text]"))
		.forEach((card) => {
			const matchesSearch = !searchValue || card.dataset.text.includes(searchValue) || card.textContent.toLowerCase().includes(searchValue);
			const matchesCategory = categoryValue === "all" || card.dataset.category === categoryValue;
			const matchesStatus = statusValue === "all" || card.dataset.status === statusValue;
			const isVisible = matchesSearch && matchesCategory && matchesStatus;

			card.hidden = !isVisible;
			if (isVisible) {
				visibleCount += 1;
			}
		});

	if (suggestionEmptyState) {
		suggestionEmptyState.hidden = visibleCount !== 0;
	}
}

function setSuggestionViewMode(mode) {
	if (!suggestionBoard) {
		return;
	}

	suggestionBoard.classList.toggle("is-grid", mode === "grid");
	suggestionBoard.classList.toggle("is-list", mode !== "grid");

	viewToggleButtons.forEach((button) => {
		const isActive = button.dataset.viewMode === mode;
		button.classList.toggle("is-active", isActive);
	});
}

tabButtons.forEach((button) => {
	button.addEventListener("click", () => {
		setActiveTab(button.dataset.tabTarget);
	});
});

adminNavButtons.forEach((button) => {
	button.addEventListener("click", () => {
		setAdminPanel(button.dataset.adminTarget);
	});
});

if (adminNavButtons.length > 0) {
	const initialAdminPanel = adminNavButtons.find((button) => button.classList.contains("is-active"))?.dataset.adminTarget || adminNavButtons[0].dataset.adminTarget;
	setAdminPanel(initialAdminPanel);
}

if (suggestionSearch) {
	suggestionSearch.addEventListener("input", updateSuggestionBoardVisibility);
}

if (categoryFilter) {
	categoryFilter.addEventListener("change", updateSuggestionBoardVisibility);
}

if (statusFilter) {
	statusFilter.addEventListener("change", updateSuggestionBoardVisibility);
}

viewToggleButtons.forEach((button) => {
	button.addEventListener("click", () => {
		setSuggestionViewMode(button.dataset.viewMode);
	});
});

if (suggestionBoard) {
	setSuggestionViewMode("list");
	updateSuggestionBoardVisibility();
}

if (tabButtons.length > 0) {
	const initialTab = tabButtons.find((button) => button.classList.contains("is-active"))?.dataset.tabTarget || tabButtons[0].dataset.tabTarget;
	setActiveTab(initialTab);
}

if (suggestionInput && charCount) {
	const updateCount = () => {
		charCount.textContent = String(suggestionInput.value.length);
	};

	suggestionInput.addEventListener("input", updateCount);
	updateCount();
}

if (suggestionForm && suggestionInput) {
	suggestionForm.addEventListener("submit", (event) => {
		event.preventDefault();
		if (!suggestionInput.value.trim()) {
			suggestionInput.focus();
		}
	});
}
