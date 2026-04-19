const suggestionInput = document.getElementById("suggestion");
const charCount = document.getElementById("charCount");
const sendButton = document.getElementById("sendButton");
const feed = document.getElementById("feed");
const statTotal = document.getElementById("statTotal");
const statCategory = document.getElementById("statCategory");

const categoryKeywords = {
	"Classroom": ["class", "lesson", "teacher", "professor", "subject", "quiz", "exam", "project"],
	"Campus Facilities": ["library", "lab", "wifi", "room", "classroom", "canteen", "aircon", "facility"],
	"Academic Services": ["grading", "adviser", "advising", "schedule", "registrar", "curriculum", "academic"],
	"Student Life": ["club", "event", "activity", "org", "student life", "sports", "festival"],
	"Admin Process": ["enrollment", "payment", "clearance", "process", "form", "approval", "queue"],
	"Campus Safety": ["safety", "security", "gate", "guard", "emergency", "hazard", "crowd"]
};

const categoryTotals = {
	"Classroom": 26,
	"Campus Facilities": 32,
	"Academic Services": 21,
	"Student Life": 19,
	"Admin Process": 16,
	"Campus Safety": 12
};

function updateCount() {
	charCount.textContent = suggestionInput.value.length;
}

function detectCategory(text) {
	const value = text.toLowerCase();
	for (const [category, words] of Object.entries(categoryKeywords)) {
		if (words.some((word) => value.includes(word))) {
			return category;
		}
	}
	return "Academic Services";
}

function detectSentiment(text) {
	const value = text.toLowerCase();
	const positiveWords = ["love", "great", "good", "better", "awesome", "helpful"];
	const negativeWords = ["bad", "worse", "issue", "problem", "confusing", "full", "slow"];

	if (negativeWords.some((word) => value.includes(word))) {
		return { label: "Negative", css: "negative" };
	}
	if (positiveWords.some((word) => value.includes(word))) {
		return { label: "Positive", css: "positive" };
	}
	return { label: "Neutral", css: "neutral" };
}

function updateTopCategory() {
	let topName = "Campus Facilities";
	let topCount = -1;

	for (const [name, count] of Object.entries(categoryTotals)) {
		if (count > topCount) {
			topName = name;
			topCount = count;
		}
	}

	statCategory.textContent = `#${topName}`;
}

suggestionInput.addEventListener("input", updateCount);

sendButton.addEventListener("click", () => {
	const text = suggestionInput.value.trim();
	if (!text) {
		suggestionInput.focus();
		return;
	}

	const category = detectCategory(text);
	const sentiment = detectSentiment(text);
	categoryTotals[category] += 1;

	const currentTotal = Number(statTotal.textContent) || 0;
	statTotal.textContent = currentTotal + 1;
	updateTopCategory();

	const item = document.createElement("article");
	item.className = "feed-item";
	item.innerHTML = `
		<div class="feed-top"><span>just now</span><span>⋮</span></div>
		<p class="feed-body"></p>
		<div class="feed-bottom">
			<span class="tag">#${category}</span>
			<span class="sentiment ${sentiment.css}">${sentiment.label}</span>
		</div>
	`;

	item.querySelector(".feed-body").textContent = text;
	feed.prepend(item);

	suggestionInput.value = "";
	updateCount();
});
