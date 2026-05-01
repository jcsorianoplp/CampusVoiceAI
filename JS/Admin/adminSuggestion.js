function normalize(value) {
	return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\"/g, "&quot;")
		.replace(/'/g, "&#39;");
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
	let suggestionEmptyState = document.getElementById("suggestionEmptyState");
	const viewToggleButtons = Array.from(document.querySelectorAll("[data-view-mode]"));
	const suggestionTotalCount = document.getElementById("suggestionTotalCount");
	const suggestionOpenCount = document.getElementById("suggestionOpenCount");
	const suggestionResolvedCount = document.getElementById("suggestionResolvedCount");

	if (!suggestionBoard) {
		return false;
	}

	function getCards() {
		return Array.from(suggestionBoard.querySelectorAll(".admin-suggestion-card"));
	}

	function buildSuggestionCard(suggestion) {
		const category = escapeHtml(suggestion.category || "Uncategorized");
		const status = normalize(suggestion.status || "open");
		const sentiment = normalize(suggestion.sentiment || "neutral");
		const statusLabel = escapeHtml(suggestion.statusLabel || (status === "progress" ? "In Progress" : status === "resolved" ? "Resolved" : "Open"));
		const sentimentLabel = escapeHtml(suggestion.sentiment || "Neutral");
		const text = escapeHtml(suggestion.text || "");
		const time = escapeHtml(suggestion.time || suggestion.createdAt || "Just now");

		return `
			<article class="admin-suggestion-card" data-category="${category}" data-status="${status}" data-sentiment="${sentiment}" data-text="${escapeHtml(suggestion.text || "")}">
				<div class="admin-suggestion-top">
					<span>${time}</span>
					<span class="admin-suggestion-category">#${category}</span>
				</div>
				<p>${text}</p>
				<div class="admin-suggestion-bottom">
					<span class="status-pill status-pill--${status === "resolved" ? "done" : status}">${statusLabel}</span>
					<span class="admin-suggestion-sentiment admin-suggestion-sentiment--${sentiment}">${sentimentLabel}</span>
				</div>
			</article>
		`;
	}

	function renderSuggestionCards(state) {
		const suggestions = Array.isArray(state?.suggestions) ? state.suggestions : [];
		const emptyMarkup = '<div class="admin-empty-state" id="suggestionEmptyState">No suggestions yet. New submissions will appear here.</div>';
		const cardsMarkup = suggestions.map(buildSuggestionCard).join("");
		suggestionBoard.innerHTML = `${cardsMarkup}${emptyMarkup}`;
		suggestionEmptyState = document.getElementById("suggestionEmptyState");
	}

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
		const cards = getCards();
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
			const hasSuggestions = cards.length > 0;
			suggestionEmptyState.hidden = hasSuggestions && visibleCount !== 0;
			suggestionEmptyState.textContent = hasSuggestions
				? "No suggestions match the current search or filters."
				: "No suggestions yet. New submissions will appear here.";
			suggestionEmptyState.style.display = hasSuggestions && visibleCount !== 0 ? "none" : "";
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
			renderSuggestionCards(state);
			syncMetaCounts(state);
			syncCategoryOptions(state);
			updateSuggestionBoardVisibility();
		});
	}

	renderSuggestionCards(window.CampusVoiceAdminState?.getState?.());
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
