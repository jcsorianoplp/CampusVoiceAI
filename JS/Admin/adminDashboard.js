const generatedSlug = document.getElementById("generatedSlug");
const previewSlug = document.getElementById("previewSlug");
const previewSlugMirror = document.getElementById("previewSlugMirror");
const regenerateLinkButton = document.getElementById("regenerateLink");
const copyGeneratedLinkButton = document.getElementById("copyGeneratedLink");
const linkFeedback = document.getElementById("linkFeedback");
const publicPreviewCard = document.getElementById("publicPreviewCard");
const previewAccentButtons = Array.from(document.querySelectorAll("[data-preview-accent]"));
const overviewSnapshotList = document.getElementById("overviewSnapshotList");

const slugSeeds = [
	"computer-society",
	"student-affairs",
	"campus-safety",
	"events-board",
	"academic-help",
	"org-feedback"
];

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

const suggestionRecords = [
	{
		time: "2 min ago",
		category: "Campus Facilities",
		status: "open",
		statusLabel: "Open",
		sentiment: "Neutral",
		text: "The library air-conditioning is too weak in the afternoon."
	},
	{
		time: "15 min ago",
		category: "Student Life",
		status: "progress",
		statusLabel: "In Progress",
		sentiment: "Positive",
		text: "Can we have more student org activities between midterms and finals week?"
	}
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

	if (previewSlugMirror) {
		previewSlugMirror.textContent = `campusvoice.ai/${slug}`;
	}
}

function setPreviewAccent(themeName) {
	const theme = previewAccentThemes[themeName] || previewAccentThemes.ocean;

	if (publicPreviewCard) {
		publicPreviewCard.style.setProperty("--preview-accent", theme.accent);
		publicPreviewCard.style.setProperty("--preview-accent-soft", theme.soft);
	}

	previewAccentButtons.forEach((button) => {
		const isActive = button.dataset.previewAccent === themeName;
		button.classList.toggle("is-active", isActive);
	});
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

function renderOverviewSnapshot() {
	if (!overviewSnapshotList) {
		return;
	}

	overviewSnapshotList.innerHTML = suggestionRecords
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

if (generatedSlug) {
	setGeneratedLink(createRandomSlug());
}

if (previewAccentButtons.length > 0) {
	const initialAccent = previewAccentButtons.find((button) => button.classList.contains("is-active"))?.dataset.previewAccent || previewAccentButtons[0].dataset.previewAccent;
	setPreviewAccent(initialAccent);

	previewAccentButtons.forEach((button) => {
		button.addEventListener("click", () => {
			setPreviewAccent(button.dataset.previewAccent);
		});
	});
}

renderOverviewSnapshot();

if (regenerateLinkButton && generatedSlug) {
	regenerateLinkButton.addEventListener("click", () => {
		setGeneratedLink(createRandomSlug());
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
