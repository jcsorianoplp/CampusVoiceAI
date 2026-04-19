const tabButtons = Array.from(document.querySelectorAll("[data-tab-target]"));
const tabPanels = Array.from(document.querySelectorAll("[data-panel]"));
const suggestionInput = document.getElementById("suggestion");
const charCount = document.getElementById("charCount");
const suggestionForm = document.getElementById("suggestionForm");

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

tabButtons.forEach((button) => {
	button.addEventListener("click", () => {
		setActiveTab(button.dataset.tabTarget);
	});
});

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
