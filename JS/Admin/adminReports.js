const reportLiveStatus = document.getElementById("reportLiveStatus");
const reportConfigForm = document.getElementById("reportConfigForm");
const reportTitleInput = document.getElementById("reportTitleInput");
const reportRangeSelect = document.getElementById("reportRangeSelect");
const reportAudienceSelect = document.getElementById("reportAudienceSelect");
const reportIncludeCategories = document.getElementById("reportIncludeCategories");
const reportIncludeSentiment = document.getElementById("reportIncludeSentiment");
const reportIncludeQueue = document.getElementById("reportIncludeQueue");
const reportActionStatus = document.getElementById("reportActionStatus");

const reportSuggestionCount = document.getElementById("reportSuggestionCount");
const reportResolutionRate = document.getElementById("reportResolutionRate");
const reportConfidenceAvg = document.getElementById("reportConfidenceAvg");
const reportQueueBacklog = document.getElementById("reportQueueBacklog");

const reportCategoryBars = document.getElementById("reportCategoryBars");
const reportSummaryOutput = document.getElementById("reportSummaryOutput");
const reportHistoryList = document.getElementById("reportHistoryList");
const reportToolbarTitle = document.querySelector(".admin-report-toolbar h2");

const generateReportBtn = document.getElementById("generateReportBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const exportSummaryBtn = document.getElementById("exportSummaryBtn");

function getProfileState() {
	try {
		const raw = window.sessionStorage.getItem("campusvoice-admin-profile-settings");
		if (!raw) {
			return {
				organization: "Computer Society",
				name: "Campus Voice Admin"
			};
		}

		const parsed = JSON.parse(raw);
		return {
			organization: parsed.organization || "Computer Society",
			name: parsed.name || "Campus Voice Admin"
		};
	} catch (error) {
		return {
			organization: "Computer Society",
			name: "Campus Voice Admin"
		};
	}
}

function getScopedSuggestions(state, range) {
	if (range === "7") {
		return state.suggestions.slice(0, Math.min(4, state.suggestions.length));
	}

	if (range === "30") {
		return state.suggestions.slice(0, Math.min(6, state.suggestions.length));
	}

	return state.suggestions.slice();
}

function getCategoryBreakdown(suggestions) {
	const counts = new Map();

	suggestions.forEach((suggestion) => {
		counts.set(suggestion.category, (counts.get(suggestion.category) || 0) + 1);
	});

	return Array.from(counts.entries())
		.map(([name, volume]) => ({ name, volume }))
		.sort((left, right) => right.volume - left.volume);
}

function getSentimentBreakdown(suggestions) {
	const counts = {
		positive: 0,
		neutral: 0,
		negative: 0
	};

	suggestions.forEach((suggestion) => {
		const key = String(suggestion.sentiment || "").toLowerCase();
		if (Object.prototype.hasOwnProperty.call(counts, key)) {
			counts[key] += 1;
		}
	});

	return counts;
}

function renderStats(state, scopedSuggestions) {
	if (reportSuggestionCount) {
		reportSuggestionCount.textContent = String(scopedSuggestions.length);
	}

	const resolvedCount = scopedSuggestions.filter((suggestion) => suggestion.status === "resolved").length;
	const resolutionRate = scopedSuggestions.length
		? Math.round((resolvedCount / scopedSuggestions.length) * 100)
		: 0;

	if (reportResolutionRate) {
		reportResolutionRate.textContent = `${resolutionRate}%`;
	}

	const avgConfidence = state.categories.length
		? Math.round(state.categories.reduce((sum, category) => sum + category.confidence, 0) / state.categories.length)
		: 0;

	if (reportConfidenceAvg) {
		reportConfidenceAvg.textContent = `${avgConfidence}%`;
	}

	if (reportQueueBacklog) {
		reportQueueBacklog.textContent = String(state.reviewQueue.length);
	}
}

function renderCategoryBars(suggestions) {
	if (!reportCategoryBars) {
		return;
	}

	const categories = getCategoryBreakdown(suggestions);
	const maxValue = categories[0]?.volume || 1;

	reportCategoryBars.innerHTML = categories.length
		? categories.map((item) => {
			const width = Math.max(8, Math.round((item.volume / maxValue) * 100));
			return `
				<div class="admin-report-bar">
					<div class="admin-report-bar-top">
						<span>${item.name}</span>
						<span>${item.volume}</span>
					</div>
					<div class="admin-report-track"><div class="admin-report-fill" style="width:${width}%"></div></div>
				</div>
			`;
		}).join("")
		: "<div class=\"admin-ai-status\">No data available for this range.</div>";
}

function buildSummary(state, scopedSuggestions) {
	const config = state.reportConfig;
	const profile = getProfileState();
	const categories = getCategoryBreakdown(scopedSuggestions);
	const topCategory = categories[0]?.name || "No data";
	const resolvedCount = scopedSuggestions.filter((suggestion) => suggestion.status === "resolved").length;
	const openCount = scopedSuggestions.filter((suggestion) => suggestion.status === "open").length;
	const progressCount = scopedSuggestions.filter((suggestion) => suggestion.status === "progress").length;
	const resolutionRate = scopedSuggestions.length
		? Math.round((resolvedCount / scopedSuggestions.length) * 100)
		: 0;

	const lines = [
		`${config.title || "Campus Voice Report"}`,
		`Organization: ${profile.organization}`,
		`Prepared by: ${profile.name}`,
		`Audience: ${config.audience}`,
		`Range: ${config.range === "7" ? "Last 7 days" : config.range === "30" ? "Last 30 days" : "All records"}`,
		"",
		`Total suggestions in scope: ${scopedSuggestions.length}`,
		`Resolution rate: ${resolutionRate}% (${resolvedCount} resolved, ${progressCount} in progress, ${openCount} open)`,
		`Top category: ${topCategory}`
	];

	if (config.includeSentiment) {
		const sentiment = getSentimentBreakdown(scopedSuggestions);
		lines.push(`Sentiment mix: ${sentiment.positive} positive, ${sentiment.neutral} neutral, ${sentiment.negative} negative`);
	}

	if (config.includeQueue) {
		lines.push(`Low-confidence backlog: ${state.reviewQueue.length} item(s) awaiting admin review`);
	}

	if (config.includeCategories && categories.length) {
		const categoryText = categories
			.slice(0, 4)
			.map((item) => `${item.name} (${item.volume})`)
			.join(", ");
		lines.push(`Category highlights: ${categoryText}`);
	}

	lines.push("", `Generated on ${new Date().toLocaleString()}`);
	return lines.join("\n");
}

function renderHistory(state) {
	if (!reportHistoryList) {
		return;
	}

	reportHistoryList.innerHTML = state.reportHistory.length
		? state.reportHistory
			.slice(0, 6)
			.map((entry) => `
				<li>
					<strong>${entry.title}</strong>
					<span>${entry.createdAt} • ${entry.audience} • ${entry.suggestions} suggestions</span>
					<span>Resolution: ${entry.resolvedRate}</span>
				</li>
			`)
			.join("")
		: "<li><span>No report history yet.</span></li>";
}

function syncForm(state) {
	const config = state.reportConfig;
	if (reportTitleInput && reportTitleInput.value !== config.title) {
		reportTitleInput.value = config.title;
	}
	if (reportRangeSelect) {
		reportRangeSelect.value = config.range;
	}
	if (reportAudienceSelect) {
		reportAudienceSelect.value = config.audience;
	}
	if (reportIncludeQueue) {
		reportIncludeQueue.checked = !!config.includeQueue;
	}
	if (reportIncludeSentiment) {
		reportIncludeSentiment.checked = !!config.includeSentiment;
	}
	if (reportIncludeCategories) {
		reportIncludeCategories.checked = !!config.includeCategories;
	}
}

function renderFromState(state, meta) {
	const scopedSuggestions = getScopedSuggestions(state, state.reportConfig.range);
	const profile = getProfileState();
	renderStats(state, scopedSuggestions);
	renderCategoryBars(scopedSuggestions);
	renderHistory(state);
	syncForm(state);

	if (reportToolbarTitle) {
		reportToolbarTitle.textContent = `Generate clear reports for ${profile.organization}`;
	}

	if (reportSummaryOutput) {
		reportSummaryOutput.value = buildSummary(state, scopedSuggestions);
	}

	if (reportLiveStatus) {
		const source = meta?.source ? String(meta.source).replace(/-/g, " ") : "state sync";
		reportLiveStatus.textContent = `Live sync active. Last update from ${source} at ${new Date().toLocaleString()}.`;
	}
}

function updateConfigFromForm(sourceLabel) {
	if (!window.CampusVoiceAdminState) {
		return;
	}

	window.CampusVoiceAdminState.updateState((state) => {
		state.reportConfig.title = reportTitleInput?.value.trim() || "Campus Voice Report";
		state.reportConfig.range = reportRangeSelect?.value || "30";
		state.reportConfig.audience = reportAudienceSelect?.value || "Leadership";
		state.reportConfig.includeQueue = !!reportIncludeQueue?.checked;
		state.reportConfig.includeSentiment = !!reportIncludeSentiment?.checked;
		state.reportConfig.includeCategories = !!reportIncludeCategories?.checked;
		return state;
	}, sourceLabel);
}

function downloadFile(filename, content, mimeType) {
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}

function sanitizeFilename(input) {
	return String(input || "campus-voice-report")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60) || "campus-voice-report";
}

function exportPdfReport(state, summaryText) {
	const jsPdfNamespace = window.jspdf;
	if (!jsPdfNamespace || !jsPdfNamespace.jsPDF) {
		throw new Error("jsPDF library is unavailable.");
	}

	const { jsPDF } = jsPdfNamespace;
	const doc = new jsPDF({ unit: "pt", format: "a4" });
	const pageWidth = doc.internal.pageSize.getWidth();
	const pageHeight = doc.internal.pageSize.getHeight();
	const margin = 48;
	const contentWidth = pageWidth - (margin * 2);

	const profile = getProfileState();

	let cursorY = margin;
	doc.setFont("helvetica", "bold");
	doc.setFontSize(17);
	doc.text(state.reportConfig.title || "Campus Voice Report", margin, cursorY);

	cursorY += 22;
	doc.setFont("helvetica", "normal");
	doc.setFontSize(10.5);
	doc.text(`Organization: ${profile.organization}`, margin, cursorY);
	cursorY += 15;
	doc.text(`Prepared by: ${profile.name}`, margin, cursorY);
	cursorY += 15;
	doc.text(`Audience: ${state.reportConfig.audience}`, margin, cursorY);
	cursorY += 15;
	doc.text(`Range: ${state.reportConfig.range === "7" ? "Last 7 days" : state.reportConfig.range === "30" ? "Last 30 days" : "All records"}`, margin, cursorY);
	cursorY += 15;
	doc.text(`Generated: ${new Date().toLocaleString()}`, margin, cursorY);

	cursorY += 20;
	doc.setFont("helvetica", "bold");
	doc.setFontSize(12);
	doc.text("Executive Summary", margin, cursorY);

	cursorY += 14;
	doc.setFont("helvetica", "normal");
	doc.setFontSize(10.5);
	const summaryLines = doc.splitTextToSize(summaryText, contentWidth);

	summaryLines.forEach((line) => {
		if (cursorY > pageHeight - margin) {
			doc.addPage();
			cursorY = margin;
		}
		doc.text(line, margin, cursorY);
		cursorY += 14;
	});

	const filename = `${sanitizeFilename(state.reportConfig.title)}-${new Date().toISOString().slice(0, 10)}.pdf`;
	doc.save(filename);
}

if (reportConfigForm) {
	reportConfigForm.addEventListener("submit", (event) => {
		event.preventDefault();
		if (!window.CampusVoiceAdminState) return;

		updateConfigFromForm("reports-config");

		const currentState = window.CampusVoiceAdminState.getState();
		const scopedSuggestions = getScopedSuggestions(currentState, currentState.reportConfig.range);
		const resolvedCount = scopedSuggestions.filter((suggestion) => suggestion.status === "resolved").length;
		const resolvedRate = scopedSuggestions.length ? `${Math.round((resolvedCount / scopedSuggestions.length) * 100)}%` : "0%";
		const summaryText = buildSummary(currentState, scopedSuggestions);

		try {
			exportPdfReport(currentState, summaryText);
		} catch (error) {
			downloadFile(
				`${sanitizeFilename(currentState.reportConfig.title)}.txt`,
				summaryText,
				"text/plain;charset=utf-8"
			);
		}

		window.CampusVoiceAdminState.updateState((state) => {
			state.reportHistory.unshift({
				id: `rp-${Date.now()}`,
				title: state.reportConfig.title,
				range: state.reportConfig.range,
				audience: state.reportConfig.audience,
				createdAt: new Date().toLocaleString(),
				suggestions: scopedSuggestions.length,
				resolvedRate: resolvedRate
			});
			state.reportHistory = state.reportHistory.slice(0, 10);
			state.lastUpdated = new Date().toLocaleString();
			return state;
		}, "reports-generate");

		if (reportActionStatus) {
			reportActionStatus.textContent = "PDF generated and report added to history.";
		}
	});
}

[reportTitleInput, reportRangeSelect, reportAudienceSelect, reportIncludeQueue, reportIncludeSentiment, reportIncludeCategories]
	.filter(Boolean)
	.forEach((element) => {
		element.addEventListener("change", () => {
			updateConfigFromForm("reports-config-change");
		});
	});

if (exportCsvBtn) {
	exportCsvBtn.addEventListener("click", () => {
		if (!window.CampusVoiceAdminState) return;
		const state = window.CampusVoiceAdminState.getState();
		const scopedSuggestions = getScopedSuggestions(state, state.reportConfig.range);
		const csvRows = [
			["time", "category", "status", "sentiment", "text"],
			...scopedSuggestions.map((item) => [item.time, item.category, item.status, item.sentiment, item.text])
		].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","));
		downloadFile("campus-voice-report.csv", `${csvRows.join("\n")}\n`, "text/csv;charset=utf-8");
		if (reportActionStatus) {
			reportActionStatus.textContent = "CSV exported.";
		}
	});
}

if (exportSummaryBtn) {
	exportSummaryBtn.addEventListener("click", () => {
		const summary = reportSummaryOutput?.value || "";
		downloadFile("campus-voice-summary.txt", summary, "text/plain;charset=utf-8");
		if (reportActionStatus) {
			reportActionStatus.textContent = "Summary exported.";
		}
	});
}

if (generateReportBtn) {
	generateReportBtn.addEventListener("click", () => {
		if (reportActionStatus) {
			reportActionStatus.textContent = "Generating report...";
		}
	});
}

if (window.CampusVoiceAdminState) {
	window.CampusVoiceAdminState.subscribe((state, meta) => {
		renderFromState(state, meta);
	});
}
