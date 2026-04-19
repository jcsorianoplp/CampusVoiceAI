const rangeButtons = Array.from(document.querySelectorAll("[data-range]"));
const trendBars = Array.from(document.querySelectorAll(".trend-bar span"));
const noteInput = document.getElementById("publicSummaryNote");
const noteCount = document.getElementById("publicNoteCount");
const lastUpdated = document.getElementById("publicLastUpdated");
const publishButton = document.getElementById("publishPublicStats");
const refreshButton = document.getElementById("refreshPublicStats");

const totalValue = document.getElementById("publicTotalValue");
const resolutionValue = document.getElementById("publicResolutionValue");
const responseTimeValue = document.getElementById("publicResponseTimeValue");
const topCategoryValue = document.getElementById("publicTopCategoryValue");

const rangeData = {
	"7": {
		total: "124",
		resolution: "67%",
		response: "2.4d",
		topCategory: "Facilities",
		bars: [52, 61, 44, 58, 66, 48, 56]
	},
	"30": {
		total: "486",
		resolution: "71%",
		response: "2.1d",
		topCategory: "Student Life",
		bars: [38, 45, 55, 62, 58, 69, 74]
	}
};

function applyRange(rangeKey) {
	const data = rangeData[rangeKey] || rangeData["7"];

	if (totalValue) totalValue.textContent = data.total;
	if (resolutionValue) resolutionValue.textContent = data.resolution;
	if (responseTimeValue) responseTimeValue.textContent = data.response;
	if (topCategoryValue) topCategoryValue.textContent = data.topCategory;

	trendBars.forEach((bar, index) => {
		const value = data.bars[index] || 30;
		bar.style.height = `${value}%`;
	});

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

function updateTimestamp(label) {
	if (!lastUpdated) {
		return;
	}

	const timeText = new Date().toLocaleString();
	lastUpdated.textContent = `${label}: ${timeText}`;
}

rangeButtons.forEach((button) => {
	button.addEventListener("click", () => {
		applyRange(button.dataset.range);
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
	noteInput.addEventListener("input", updateNoteCount);
	updateNoteCount();
}

if (refreshButton) {
	refreshButton.addEventListener("click", () => {
		const activeRange = rangeButtons.find((button) => button.classList.contains("is-active"))?.dataset.range || "7";
		applyRange(activeRange);
		updateTimestamp("Refreshed");
	});
}

if (publishButton) {
	publishButton.addEventListener("click", () => {
		updateTimestamp("Published");
	});
}

applyRange("7");