function normalize(value) {
	return String(value || "").trim().toLowerCase();
}

function initAdminSuggestionPage() {
	const suggestionSearch = document.getElementById("suggestionSearch");
	const categoryFilter = document.getElementById("categoryFilter");
	const statusFilter = document.getElementById("statusFilter");
	const suggestionBoard = document.getElementById("suggestionBoard");
	const suggestionEmptyState = document.getElementById("suggestionEmptyState");
	const viewToggleButtons = Array.from(document.querySelectorAll("[data-view-mode]"));

	if (!suggestionBoard) {
		return;
	}

	const cards = Array.from(suggestionBoard.querySelectorAll("[data-category][data-status]"));

	function updateSuggestionBoardVisibility() {
		const searchValue = normalize(suggestionSearch ? suggestionSearch.value : "");
		const categoryValue = normalize(categoryFilter ? categoryFilter.value : "all");
		const statusValue = normalize(statusFilter ? statusFilter.value : "all");
		let visibleCount = 0;

		cards.forEach((card) => {
			const cardText = normalize(card.dataset.text || "");
			const fullText = normalize(card.textContent || "");
			const cardCategory = normalize(card.dataset.category);
			const cardStatus = normalize(card.dataset.status);

			const matchesSearch = !searchValue || cardText.includes(searchValue) || fullText.includes(searchValue);
			const matchesCategory = categoryValue === "all" || cardCategory === categoryValue;
			const matchesStatus = statusValue === "all" || cardStatus === statusValue;
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
		suggestionBoard.classList.toggle("is-grid", mode === "grid");
		suggestionBoard.classList.toggle("is-list", mode !== "grid");

		viewToggleButtons.forEach((button) => {
			const isActive = button.dataset.viewMode === mode;
			button.classList.toggle("is-active", isActive);
		});
	}

	if (suggestionSearch) {
		suggestionSearch.addEventListener("input", updateSuggestionBoardVisibility);
		suggestionSearch.addEventListener("search", updateSuggestionBoardVisibility);
		suggestionSearch.addEventListener("keyup", updateSuggestionBoardVisibility);
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

	setSuggestionViewMode("list");
	updateSuggestionBoardVisibility();
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initAdminSuggestionPage);
} else {
	initAdminSuggestionPage();
}
