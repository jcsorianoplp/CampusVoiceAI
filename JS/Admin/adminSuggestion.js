function normalize(value) {
	return String(value || "").trim().toLowerCase();
}

let suggestionPageInitialized = false;

function initAdminSuggestionPage() {
	if (suggestionPageInitialized) {
		return true;
	}

	const suggestionSearch = document.getElementById("suggestionSearch");
	const categoryFilter = document.getElementById("categoryFilter");
	const statusFilter = document.getElementById("statusFilter");
	const sentimentFilter = document.getElementById("sentimentFilter");
	const suggestionBoard = document.getElementById("suggestionBoard");
	const suggestionEmptyState = document.getElementById("suggestionEmptyState");
	const viewToggleButtons = Array.from(document.querySelectorAll("[data-view-mode]"));
	const suggestionTotalCount = document.getElementById("suggestionTotalCount");
	const suggestionOpenCount = document.getElementById("suggestionOpenCount");
	const suggestionResolvedCount = document.getElementById("suggestionResolvedCount");

	if (!suggestionBoard) {
		return false;
	}

	const cards = Array.from(suggestionBoard.querySelectorAll("[data-category][data-status][data-sentiment]"));

	function syncMetaCounts(state) {
		if (!state) return;

		if (suggestionTotalCount) {
			suggestionTotalCount.textContent = `${state.suggestions.length} total`;
		}

		if (suggestionOpenCount) {
			const openCount = state.suggestions.filter((suggestion) => suggestion.status === "open").length;
			suggestionOpenCount.textContent = `${openCount} open`;
		}

		if (suggestionResolvedCount) {
			const resolvedCount = state.suggestions.filter((suggestion) => suggestion.status === "resolved").length;
			suggestionResolvedCount.textContent = `${resolvedCount} resolved`;
		}
	}

	function syncCategoryOptions(state) {
		if (!categoryFilter || !state) return;

		const selectedValue = categoryFilter.value;
		const categoryNames = Array.from(new Set([
			...state.categories.map((category) => category.name),
			...state.suggestions.map((suggestion) => suggestion.category)
		]));

		categoryFilter.innerHTML = [
			'<option value="all">All Categories</option>',
			...categoryNames.map((name) => `<option value="${name}">${name}</option>`)
		].join("");

		if (categoryNames.includes(selectedValue) || selectedValue === "all") {
			categoryFilter.value = selectedValue;
		}
	}

	function updateSuggestionBoardVisibility() {
		const searchValue = normalize(suggestionSearch ? suggestionSearch.value : "");
		const categoryValue = normalize(categoryFilter ? categoryFilter.value : "all");
		const statusValue = normalize(statusFilter ? statusFilter.value : "all");
		const sentimentValue = normalize(sentimentFilter ? sentimentFilter.value : "all");
		let visibleCount = 0;

		cards.forEach((card) => {
			const cardText = normalize(card.dataset.text || "");
			const fullText = normalize(card.textContent || "");
			const cardCategory = normalize(card.dataset.category);
			const cardStatus = normalize(card.dataset.status);
			const cardSentiment = normalize(card.dataset.sentiment);

			const matchesSearch = !searchValue || cardText.includes(searchValue) || fullText.includes(searchValue);
			const matchesCategory = categoryValue === "all" || cardCategory === categoryValue;
			const matchesStatus = statusValue === "all" || cardStatus === statusValue;
			const matchesSentiment = sentimentValue === "all" || cardSentiment === sentimentValue;
			const isVisible = matchesSearch && matchesCategory && matchesStatus && matchesSentiment;

			card.hidden = !isVisible;
			card.style.display = isVisible ? "" : "none";
			if (isVisible) {
				visibleCount += 1;
			}
		});

		if (suggestionEmptyState) {
			suggestionEmptyState.hidden = visibleCount !== 0;
			suggestionEmptyState.style.display = visibleCount === 0 ? "" : "none";
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

	if (sentimentFilter) {
		sentimentFilter.addEventListener("change", updateSuggestionBoardVisibility);
	}

	viewToggleButtons.forEach((button) => {
		button.addEventListener("click", () => {
			setSuggestionViewMode(button.dataset.viewMode);
		});
	});

	if (window.CampusVoiceAdminState) {
		window.CampusVoiceAdminState.subscribe((state) => {
			syncMetaCounts(state);
			syncCategoryOptions(state);
			updateSuggestionBoardVisibility();
		});
	}

	setSuggestionViewMode("list");
	updateSuggestionBoardVisibility();
	suggestionPageInitialized = true;
	return true;
}

const initializedImmediately = initAdminSuggestionPage();

if (!initializedImmediately) {
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initAdminSuggestionPage, { once: true });
	}

	window.addEventListener("load", initAdminSuggestionPage, { once: true });

	const initRetryTimer = window.setInterval(() => {
		if (initAdminSuggestionPage()) {
			window.clearInterval(initRetryTimer);
		}
	}, 250);

	window.setTimeout(() => {
		window.clearInterval(initRetryTimer);
	}, 5000);
}
