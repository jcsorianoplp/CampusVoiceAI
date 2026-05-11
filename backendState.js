function clone(value) {
	if (typeof window !== "undefined" && typeof window.structuredClone === "function") {
		return window.structuredClone(value);
	}

	return JSON.parse(JSON.stringify(value));
}

function normalizePercent(value, fallback) {
	const numericValue = Number(value);
	if (!Number.isFinite(numericValue)) {
		return fallback;
	}

	if (numericValue <= 1) {
		return Math.round(numericValue * 100);
	}

	return Math.round(numericValue);
}

function percentToDbValue(value) {
	return Math.max(0, Math.min(1, normalizePercent(value, 0) / 100));
}

function formatRelativeTime(timestamp) {
	if (!timestamp) {
		return "Just now";
	}

	const value = new Date(timestamp);
	if (Number.isNaN(value.getTime())) {
		return String(timestamp);
	}

	const diff = Date.now() - value.getTime();
	const minute = 60 * 1000;
	const hour = 60 * minute;
	const day = 24 * hour;

	if (diff < minute) {
		return "Just now";
	}

	if (diff < hour) {
		const minutes = Math.max(1, Math.round(diff / minute));
		return `${minutes} min ago`;
	}

	if (diff < day) {
		const hours = Math.max(1, Math.round(diff / hour));
		return `${hours} hour${hours === 1 ? "" : "s"} ago`;
	}

	if (diff < 2 * day) {
		return "Yesterday";
	}

	const days = Math.max(2, Math.round(diff / day));
	return `${days} days ago`;
}

function formatDateTime(timestamp) {
	if (!timestamp) {
		return new Date().toLocaleString();
	}

	const value = new Date(timestamp);
	if (Number.isNaN(value.getTime())) {
		return String(timestamp);
	}

	return value.toLocaleString();
}

function statusLabelFromStatus(status) {
	if (status === "open" || status === "pending") {
		return "Open";
	}

	if (status === "progress") {
		return "In Progress";
	}

	if (status === "resolved") {
		return "Resolved";
	}

	if (status === "done") {
		return "Resolved";
	}

	return "Open";
}

function normalizeSuggestionStatus(value) {
	const status = String(value || "open").trim().toLowerCase();

	if (status === "pending") {
		return "open";
	}

	if (status === "in progress") {
		return "progress";
	}

	if (status === "done") {
		return "resolved";
	}

	if (status === "open" || status === "progress" || status === "resolved") {
		return status;
	}

	return "open";
}

function normalizeImpactLevel(value) {
	const level = String(value || "medium").trim().toLowerCase();
	if (level === "high") {
		return "high";
	}

	if (level === "low") {
		return "low";
	}

	return "medium";
}

function splitKeywords(keywords) {
	if (!Array.isArray(keywords)) {
		return [];
	}

	return keywords
		.map((keyword) => String(keyword || "").trim().toLowerCase())
		.filter(Boolean)
		.slice(0, 12);
}



function parseSlaValue(value, fallback) {
	const match = String(value || "").match(/(\d+)/);
	if (!match) {
		return fallback;
	}

	return `${Number(match[1])}h`;
}

function normalizeOrganizationRow(row) {
	if (!row) {
		return null;
	}

	return {
		id: row.id,
		name: row.name,
		slug: row.slug,
		accent_color: row.accent_color,
		active_link_slug: row.active_link_slug,
		generated_slug: row.generated_slug,
		preview_accent: row.preview_accent,
		public_note: row.public_note,
		last_updated: row.last_updated
	};
}

async function fetchSingleRow(connection, sql, params) {
	const [rows] = await connection.execute(sql, params);
	return rows[0] || null;
}

async function resolveOrganizationContext(pool, payload = {}) {
	const orgId = Number(payload.orgId || payload.organizationId || 0);
	const ref = String(payload.ref || payload.slug || payload.linkSlug || "").trim();

	const whereClauses = [];
	const params = [];

	if (orgId > 0) {
		whereClauses.push("o.id = ?");
		params.push(orgId);
	}

	if (ref) {
		whereClauses.push("o.slug = ?");
		whereClauses.push("o.active_link_slug = ?");
		whereClauses.push("s.generated_slug = ?");
		params.push(ref, ref, ref);
	}

	let organizationRow = null;
	if (whereClauses.length) {
		organizationRow = await fetchSingleRow(
			pool,
			`SELECT
				o.id,
				o.name,
				o.slug,
				o.accent_color,
				o.active_link_slug,
				o.created_at,
				o.updated_at,
				s.generated_slug,
				s.preview_accent,
				s.public_note,
				s.last_updated
			 FROM organizations o
			 LEFT JOIN app_settings s ON s.org_id = o.id
			 WHERE ${whereClauses.join(" OR ")}
			 ORDER BY o.id ASC
			 LIMIT 1`,
			params
		);
	}

	if (!organizationRow) {
		organizationRow = await fetchSingleRow(
			pool,
			`SELECT
				o.id,
				o.name,
				o.slug,
				o.accent_color,
				o.active_link_slug,
				o.created_at,
				o.updated_at,
				s.generated_slug,
				s.preview_accent,
				s.public_note,
				s.last_updated
			 FROM organizations o
			 LEFT JOIN app_settings s ON s.org_id = o.id
			 ORDER BY o.id ASC
			 LIMIT 1`,
			[]
		);
	}

	return normalizeOrganizationRow(organizationRow);
}

function buildCategories(categoryRows, keywordRows, suggestionCounts) {
	const keywordMap = new Map();
	keywordRows.forEach((row) => {
		const current = keywordMap.get(row.category_id) || [];
		current.push(row.keyword);
		keywordMap.set(row.category_id, current);
	});

	const categories = categoryRows.map((row) => ({
		id: row.id,
		name: row.name,
		priority: row.priority || "medium",
		route: row.route_team || "General Review",
		sla: parseSlaValue(row.sla_target, "24h"),
		confidence: normalizePercent(row.confidence_threshold, 80),
		volume: suggestionCounts.get(row.name) || 0,
		keywords: splitKeywords(keywordMap.get(row.id))
	}));

	return categories.sort((left, right) => {
		const leftVolume = Number(left.volume || 0);
		const rightVolume = Number(right.volume || 0);
		return rightVolume - leftVolume || String(left.name).localeCompare(String(right.name));
	});
}

function buildSuggestions(suggestionRows, categoryMap) {
	return suggestionRows.map((row) => {
		const categoryName = row.category_name || "Uncategorized";
		const categoryConfidence = categoryMap.get(categoryName)?.confidence || 80;
		const hasAiConfidence = row.ai_confidence !== null && row.ai_confidence !== undefined;
		let aiConfidence = !hasAiConfidence && categoryName === "Uncategorized"
			? 45
			: normalizePercent(row.ai_confidence, categoryConfidence);

		// Enforce: Uncategorized should always be treated as low confidence.
		if (categoryName === "Uncategorized") {
			aiConfidence = Math.min(55, normalizePercent(aiConfidence, 45));
		}
		const status = normalizeSuggestionStatus(row.status || "open");
		const timestamp = row.created_at || row.updated_at || new Date();

		return {
			id: row.id,
			time: formatRelativeTime(timestamp),
			createdAt: formatDateTime(timestamp),
			createdAtIso: new Date(timestamp).toISOString(),
			category: categoryName,
			status,
			statusLabel: row.status_label || statusLabelFromStatus(status),
			sentiment: row.sentiment || "Neutral",
			impactLevel: row.impact_level || "medium",
			location: row.location || "General",
			suggestedSolution: row.suggested_solution || "",
			trackingId: row.tracking_id,
			aiConfidence,
			text: row.text
		};
	});
}

function buildReviewQueue(suggestions, threshold) {
	return suggestions
		.filter((item) => item.status !== "resolved" && normalizePercent(item.aiConfidence, 0) < threshold)
		.slice(0, 3)
		.map((item, index) => ({
			id: `rv-${index + 1}`,
			text: item.text,
			predicted: item.category,
			confidence: normalizePercent(item.aiConfidence, threshold)
		}));
}

function buildPublicFeed(suggestions) {
	const sortedSuggestions = [...suggestions].sort((left, right) => {
		const leftDate = new Date(left.createdAtIso || left.createdAt || left.time || 0).getTime();
		const rightDate = new Date(right.createdAtIso || right.createdAt || right.time || 0).getTime();
		return rightDate - leftDate;
	});

	const feed = sortedSuggestions.slice(0, 4).map((item) => ({
		time: formatRelativeTime(item.createdAt),
		category: item.category,
		status: item.status,
		statusLabel: statusLabelFromStatus(item.status),
		text: item.status === "resolved"
			? `Suggestion resolved: ${item.text}`
			: `New suggestion submitted: ${String(item.text || "").slice(0, 90)}${String(item.text || "").length > 90 ? "..." : ""}`
	}));

	return feed;
}

function buildReportHistory(reportRows) {
	return reportRows.map((row) => ({
		id: `rp-${row.id}`,
		title: row.title,
		range: String(row.range_value || "30"),
		audience: "Leadership",
		createdAt: formatDateTime(row.created_at),
		suggestions: Number(row.suggestion_count || 0),
		resolvedRate: `${normalizePercent(row.resolved_rate, 0)}%`
	}));
}

async function loadAdminState(pool, payload = {}) {
	const organization = await resolveOrganizationContext(pool, payload);
	if (!organization) {
		return {
			ok: false,
			message: "Unable to resolve the current organization."
		};
	}

	const orgId = organization.id;
	const [categoryRows] = await pool.execute(
		`SELECT id, name, priority, route_team, sla_target, confidence_threshold, is_active
		 FROM categories
		 WHERE org_id = ? AND is_active = 1
		 ORDER BY id ASC`,
		[orgId]
	);

	const [keywordRows] = await pool.execute(
		`SELECT category_id, keyword
		 FROM category_keywords
		 WHERE category_id IN (
			SELECT id FROM categories WHERE org_id = ? AND is_active = 1
		 )
		 ORDER BY category_id ASC, id ASC`,
		[orgId]
	);

	const [suggestionRows] = await pool.execute(
		`SELECT
			s.id,
			s.tracking_id,
			s.text,
			s.suggested_solution,
			s.impact_level,
			s.location,
			s.sentiment,
			s.status,
			s.ai_confidence,
			s.created_at,
			s.updated_at,
			COALESCE(c.name, 'Uncategorized') AS category_name
		 FROM suggestions s
		 LEFT JOIN categories c ON c.id = s.category_id
		 WHERE s.org_id = ?
		 ORDER BY s.created_at DESC, s.id DESC`,
		[orgId]
	);

	const [reportRows] = await pool.execute(
		`SELECT id, title, range_value, suggestion_count, resolved_rate, created_at
		 FROM report_history
		 WHERE org_id = ?
		 ORDER BY created_at DESC, id DESC`,
		[orgId]
	);

	const [aiRuleRows] = await pool.execute(
		`SELECT id, routing_threshold, uncertain_queue_enabled, public_sync_enabled, keyword_boost_enabled, updated_at
		 FROM ai_rules
		 WHERE org_id = ?
		 ORDER BY updated_at DESC, id DESC
		 LIMIT 1`,
		[orgId]
	);

	const suggestionCounts = new Map();
	suggestionRows.forEach((row) => {
		const current = suggestionCounts.get(row.category_name) || 0;
		suggestionCounts.set(row.category_name, current + 1);
	});

	const categories = buildCategories(categoryRows, keywordRows, suggestionCounts);
	const categoryMap = new Map(categories.map((category) => [category.name, category]));
	const suggestions = buildSuggestions(suggestionRows, categoryMap);
	const aiRulesRow = aiRuleRows[0] || null;
	const aiRules = aiRulesRow
		? {
			threshold: normalizePercent(aiRulesRow.routing_threshold, 80),
			uncertainQueue: Boolean(aiRulesRow.uncertain_queue_enabled),
			publicSync: Boolean(aiRulesRow.public_sync_enabled),
			keywordBoost: Boolean(aiRulesRow.keyword_boost_enabled),
			testInput: ""
		}
		: {
			threshold: 80,
			uncertainQueue: true,
			publicSync: true,
			keywordBoost: true,
			testInput: ""
		};

	const publicFeed = buildPublicFeed(suggestions);
	const reviewQueue = buildReviewQueue(suggestions, aiRules.threshold);
	const settingsSlug = organization.generated_slug || organization.active_link_slug || organization.slug || "computer-society-g8k2";
	const settingsAccent = organization.preview_accent || organization.accent_color || "#008080";
	const publicNote = organization.public_note || "";
	const lastUpdated = organization.last_updated ? formatDateTime(organization.last_updated) : formatDateTime(new Date());

	return {
		ok: true,
		organization: {
			id: orgId,
			name: organization.name,
			slug: organization.slug,
			accentColor: organization.accent_color,
			activeLinkSlug: organization.active_link_slug || settingsSlug
		},
		state: {
			organizationId: orgId,
			organizationName: organization.name,
			organizationSlug: organization.slug,
			organizationAccentColor: organization.accent_color,
			generatedSlug: settingsSlug,
			previewAccent: settingsAccent,
			aiRules,
			categories,
			reviewQueue,
			suggestions,
			publicFeed,
			reportConfig: {
				title: "Weekly Campus Voice Report",
				range: "30",
				audience: "Leadership",
				includeQueue: true,
				includeSentiment: true,
				includeCategories: true
			},
			reportHistory: buildReportHistory(reportRows),
			publicNote,
			publicRange: "7",
			lastUpdated
		}
	};
}

async function ensureCategory(connection, orgId, categoryName, template = {}) {
	const trimmedName = String(categoryName || "").trim();
	if (!trimmedName) {
		return null;
	}

	const existing = await fetchSingleRow(
		connection,
		`SELECT id FROM categories WHERE org_id = ? AND name = ? LIMIT 1`,
		[orgId, trimmedName]
	);

	if (existing) {
		return existing.id;
	}

	const routeTeam = String(template.route || template.routeTeam || "General Review").trim() || "General Review";
	const priority = ["low", "medium", "high"].includes(String(template.priority || "medium").toLowerCase())
		? String(template.priority).toLowerCase()
		: "medium";
	const slaTarget = Number.parseInt(String(template.sla || template.slaTarget || "24").replace(/[^0-9]/g, ""), 10) || 24;
	const confidenceThreshold = percentToDbValue(template.confidence || template.confidenceThreshold || 80);

	await connection.execute(
		`INSERT INTO categories (org_id, name, priority, route_team, sla_target, confidence_threshold, is_active)
		 VALUES (?, ?, ?, ?, ?, ?, 1)`,
		[orgId, trimmedName, priority, routeTeam, slaTarget, confidenceThreshold]
	);

	const inserted = await fetchSingleRow(
		connection,
		`SELECT id FROM categories WHERE org_id = ? AND name = ? LIMIT 1`,
		[orgId, trimmedName]
	);

	return inserted ? inserted.id : null;
}

async function syncAppSettings(connection, organization, state) {
	const generatedSlug = String(state.generatedSlug || organization.generated_slug || organization.active_link_slug || organization.slug || "computer-society-g8k2").trim();
	const previewAccent = String(state.previewAccent || organization.preview_accent || organization.accent_color || "#008080").trim();
	const publicNote = String(state.publicNote || organization.public_note || "").trim();

	await connection.execute(
		`INSERT INTO app_settings (org_id, generated_slug, preview_accent, public_note)
		 VALUES (?, ?, ?, ?)
		 ON DUPLICATE KEY UPDATE
		 generated_slug = VALUES(generated_slug),
		 preview_accent = VALUES(preview_accent),
		 public_note = VALUES(public_note),
		 last_updated = CURRENT_TIMESTAMP`,
		[organization.id, generatedSlug, previewAccent, publicNote]
	);

	await connection.execute(
		`UPDATE organizations
		 SET active_link_slug = ?, accent_color = ?
		 WHERE id = ?`,
		[generatedSlug, previewAccent, organization.id]
	);
}

async function syncAiRules(connection, orgId, aiRules = {}) {
	const threshold = percentToDbValue(aiRules.threshold || 80);
	const uncertainQueue = aiRules.uncertainQueue ? 1 : 0;
	const publicSync = aiRules.publicSync ? 1 : 0;
	const keywordBoost = aiRules.keywordBoost ? 1 : 0;

	const existing = await fetchSingleRow(
		connection,
		`SELECT id
		 FROM ai_rules
		 WHERE org_id = ?
		 ORDER BY updated_at DESC, id DESC
		 LIMIT 1`,
		[orgId]
	);

	if (existing) {
		await connection.execute(
			`UPDATE ai_rules
			 SET routing_threshold = ?, uncertain_queue_enabled = ?, public_sync_enabled = ?, keyword_boost_enabled = ?, updated_at = CURRENT_TIMESTAMP
			 WHERE id = ?`,
			[threshold, uncertainQueue, publicSync, keywordBoost, existing.id]
		);

		await connection.execute(
			`DELETE FROM ai_rules WHERE org_id = ? AND id <> ?`,
			[orgId, existing.id]
		);
		return;
	}

	await connection.execute(
		`INSERT INTO ai_rules (org_id, routing_threshold, uncertain_queue_enabled, public_sync_enabled, keyword_boost_enabled)
		 VALUES (?, ?, ?, ?, ?)`,
		[orgId, threshold, uncertainQueue, publicSync, keywordBoost]
	);
}

async function syncCategories(connection, orgId, categories = []) {
	const existingRows = await connection.execute(
		`SELECT id, name
		 FROM categories
		 WHERE org_id = ?`,
		[orgId]
	);
	const existingRowsArray = existingRows[0] || [];
	const existingMap = new Map(existingRowsArray.map((row) => [row.name, row.id]));
	const categoryMap = new Map();

	for (const category of categories) {
		const name = String(category.name || "").trim();
		if (!name) {
			continue;
		}

		const priority = ["low", "medium", "high"].includes(String(category.priority || "medium").toLowerCase())
			? String(category.priority).toLowerCase()
			: "medium";
		const routeTeam = String(category.route || category.routeTeam || "General Review").trim() || "General Review";
		const slaTarget = Number.parseInt(String(category.sla || category.slaTarget || "24").replace(/[^0-9]/g, ""), 10) || 24;
		const confidenceThreshold = percentToDbValue(category.confidence || category.confidenceThreshold || 80);

		await connection.execute(
			`INSERT INTO categories (org_id, name, priority, route_team, sla_target, confidence_threshold, is_active)
			 VALUES (?, ?, ?, ?, ?, ?, 1)
			 ON DUPLICATE KEY UPDATE
			 priority = VALUES(priority),
			 route_team = VALUES(route_team),
			 sla_target = VALUES(sla_target),
			 confidence_threshold = VALUES(confidence_threshold),
			 is_active = VALUES(is_active)`,
			[orgId, name, priority, routeTeam, slaTarget, confidenceThreshold]
		);

		const categoryRow = await fetchSingleRow(
			connection,
			`SELECT id
			 FROM categories
			 WHERE org_id = ? AND name = ?
			 LIMIT 1`,
			[orgId, name]
		);

		if (!categoryRow) {
			continue;
		}

		const categoryId = categoryRow.id;
		categoryMap.set(name, {
			id: categoryId,
			name,
			priority,
			route: routeTeam,
			sla: category.sla || `${slaTarget}h`,
			confidence: Math.round(confidenceThreshold * 100),
			keywords: splitKeywords(category.keywords)
		});

		await connection.execute(
			`DELETE FROM category_keywords WHERE category_id = ?`,
			[categoryId]
		);

		const keywords = splitKeywords(category.keywords);
		for (const keyword of keywords) {
			await connection.execute(
				`INSERT INTO category_keywords (category_id, keyword, weight)
				 VALUES (?, ?, 1.00)`,
				[categoryId, keyword]
			);
		}
	}

	return categoryMap;
}

async function syncSuggestions(connection, orgId, categoriesByName, suggestions = []) {
	const existingRows = await connection.execute(
		`SELECT id, tracking_id
		 FROM suggestions
		 WHERE org_id = ?`,
		[orgId]
	);
	const existingMap = new Map((existingRows[0] || []).map((row) => [row.tracking_id, row.id]));

	for (const suggestion of suggestions) {
		const trackingId = String(suggestion.trackingId || suggestion.tracking_id || "").trim();
		if (!trackingId) {
			continue;
		}

		const categoryName = String(suggestion.category || "Uncategorized").trim() || "Uncategorized";
		let categoryId = categoriesByName.get(categoryName)?.id || null;
		if (!categoryId) {
			categoryId = await ensureCategory(connection, orgId, categoryName, suggestion);
			if (categoryId) {
				categoriesByName.set(categoryName, {
					id: categoryId,
					name: categoryName,
					priority: String(suggestion.priority || "medium").toLowerCase(),
					route: String(suggestion.route || suggestion.routeTeam || "General Review"),
					sla: String(suggestion.sla || suggestion.slaTarget || "24h"),
					confidence: normalizePercent(suggestion.aiConfidence || suggestion.confidence || 80, 80),
					keywords: []
				});
			}
		}

		const aiConfidence = normalizePercent(
			suggestion.aiConfidence ?? suggestion.confidence ?? categoriesByName.get(categoryName)?.confidence ?? 80,
			80
		) / 100;
		const status = normalizeSuggestionStatus(suggestion.status || "open");
		const sentiment = String(suggestion.sentiment || "Neutral");
		const impactLevel = normalizeImpactLevel(suggestion.impactLevel || "medium");
		const location = String(suggestion.location || "").trim();
		const suggestedSolution = String(suggestion.suggestedSolution || "").trim();
		const text = String(suggestion.text || "").trim();
		const existingId = existingMap.get(trackingId);
		const resolvedAt = status === "resolved" ? new Date() : null;

		if (existingId) {
			await connection.execute(
				`UPDATE suggestions
				 SET category_id = ?, text = ?, suggested_solution = ?, impact_level = ?, location = ?, sentiment = ?, status = ?, ai_confidence = ?, resolved_at = ?
				 WHERE id = ?`,
				[
					categoryId,
					text,
					suggestedSolution,
					impactLevel,
					location,
					sentiment,
					status,
					aiConfidence,
					resolvedAt,
					existingId
				]
			);
			continue;
		}

		await connection.execute(
			`INSERT INTO suggestions (
				org_id, category_id, tracking_id, text, suggested_solution, impact_level, location, sentiment, status, ai_confidence, created_at, resolved_at
			 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
			[
				orgId,
				categoryId,
				trackingId,
				text,
				suggestedSolution,
				impactLevel,
				location,
				sentiment,
				status,
				aiConfidence,
				resolvedAt
			]
		);
	}
}

async function saveSuggestionSubmissions(connection, orgId, suggestions = []) {
	const [categoryRows] = await connection.execute(
		`SELECT id, name
		 FROM categories
		 WHERE org_id = ? AND is_active = 1
		 ORDER BY id ASC`,
		[orgId]
	);
	const normalizeCategoryKey = (value) => String(value || "").trim().toLowerCase().replace(/^campus\s+/i, "");
	const categoriesByName = new Map((categoryRows || []).map((row) => [normalizeCategoryKey(row.name), row.id]));

	const [existingRows] = await connection.execute(
		`SELECT id, tracking_id
		 FROM suggestions
		 WHERE org_id = ?`,
		[orgId]
	);
	const existingMap = new Map((existingRows || []).map((row) => [row.tracking_id, row.id]));

	async function classifyTextWithAi(text) {
		if (typeof fetch !== "function") {
			return { categoryName: "Uncategorized", aiConfidence: 45 };
		}

		try {
			const response = await fetch("http://localhost:8001/test", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text })
			});

			if (!response.ok) {
				return { categoryName: "Uncategorized", aiConfidence: 45 };
			}

			const data = await response.json();
			const categoryName = String(data.category || "Uncategorized").trim() || "Uncategorized";
			const aiConfidence = Number(data.confidence || 45);
			return {
				categoryName,
				aiConfidence: Number.isFinite(aiConfidence) ? aiConfidence : 45
			};
		} catch (error) {
			return { categoryName: "Uncategorized", aiConfidence: 45 };
		}
	}

	for (const suggestion of suggestions) {
		const trackingId = String(suggestion.trackingId || suggestion.tracking_id || "").trim();
		if (!trackingId) {
			continue;
		}

		const text = String(suggestion.text || "").trim();
		const classification = await classifyTextWithAi(text);
		const normalizedCategoryName = normalizeCategoryKey(classification.categoryName);
		const categoryId = normalizedCategoryName === "uncategorized"
			? null
			: (categoriesByName.get(normalizedCategoryName) || null);
		const rawConfidence = Number(classification.aiConfidence) || 45;
		const aiConfidence = Number.isFinite(rawConfidence) ? Math.max(0, Math.min(1, rawConfidence / 100)) : 0.45;
		const status = normalizeSuggestionStatus(suggestion.status || "open");
		const sentiment = String(suggestion.sentiment || "").trim() || null;
		const impactLevel = normalizeImpactLevel(suggestion.impactLevel || "medium");
		const location = String(suggestion.location || "").trim();
		const suggestedSolution = String(suggestion.suggestedSolution || "").trim();
		const existingId = existingMap.get(trackingId);
		const resolvedAt = status === "resolved" ? new Date() : null;

		if (existingId) {
			await connection.execute(
				`UPDATE suggestions
				 SET category_id = ?, text = ?, suggested_solution = ?, impact_level = ?, location = ?, sentiment = ?, status = ?, ai_confidence = ?, resolved_at = ?
				 WHERE id = ?`,
				[
					categoryId,
					text,
					suggestedSolution,
					impactLevel,
					location,
					sentiment,
					status,
					aiConfidence,
					resolvedAt,
					existingId
				]
			);
			continue;
		}

		await connection.execute(
			`INSERT INTO suggestions (
				org_id, category_id, tracking_id, text, suggested_solution, impact_level, location, sentiment, status, ai_confidence, created_at, resolved_at
			 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
			[
				orgId,
				categoryId,
				trackingId,
				text,
				suggestedSolution,
				impactLevel,
				location,
				sentiment,
				status,
				aiConfidence,
				resolvedAt
			]
		);
	}
}

async function updateSuggestionStatus(connection, orgId, suggestionId, status) {
	const nextStatus = normalizeSuggestionStatus(status);
	const resolvedAt = nextStatus === "resolved" ? new Date() : null;
	const numericSuggestionId = Number(suggestionId || 0);

	if (!Number.isFinite(numericSuggestionId) || numericSuggestionId <= 0) {
		return {
			ok: false,
			message: "Missing suggestion identifier."
		};
	}

	const existing = await fetchSingleRow(
		connection,
		`SELECT id
		 FROM suggestions
		 WHERE org_id = ? AND id = ?
		 LIMIT 1`,
		[orgId, numericSuggestionId]
	);

	if (!existing) {
		return {
			ok: false,
			message: "Suggestion not found."
		};
	}

	await connection.execute(
		`UPDATE suggestions
		 SET status = ?, resolved_at = ?, updated_at = CURRENT_TIMESTAMP
		 WHERE id = ? AND org_id = ?`,
		[nextStatus, resolvedAt, numericSuggestionId, orgId]
	);

	return {
		ok: true,
		message: `Suggestion marked ${statusLabelFromStatus(nextStatus).toLowerCase()}.`
	};
}

async function syncReportHistory(connection, orgId, adminId, reportHistory = []) {
	if (!reportHistory.length) {
		return;
	}

	const latestEntry = reportHistory[0];
	if (!latestEntry || !latestEntry.title) {
		return;
	}

	await connection.execute(
		`INSERT INTO report_history (org_id, title, range_value, suggestion_count, resolved_rate, created_by_admin_id)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		[
			orgId,
			String(latestEntry.title),
			String(latestEntry.range || "30"),
			Number(latestEntry.suggestions || 0),
			normalizePercent(String(latestEntry.resolvedRate || "0").replace(/%/g, ""), 0),
			adminId || null
		]
	);
}

async function saveAdminState(pool, payload = {}) {
	const organization = await resolveOrganizationContext(pool, payload);
	if (!organization) {
		return {
			ok: false,
			message: "Unable to resolve the current organization."
		};
	}

	const state = payload.state || {};
	const source = String(payload.source || "");
	const isSuggestionSubmit = source === "public-suggestion-submit";
	const isCategoryChange = source.startsWith("ai-");
	const isPublicSettingsChange = source === "public-note" || source === "public-stats-range" || source === "public-stats-refresh" || source === "public-stats-publish";
	const isDashboardLinkChange = source === "dashboard-link" || source === "dashboard-accent";
	const isReportChange = source.startsWith("reports-");
	const connection = await pool.getConnection();

	try {
		await connection.beginTransaction();
		if (isSuggestionSubmit) {
			await saveSuggestionSubmissions(connection, organization.id, state.suggestions || []);
		} else {
			if (isPublicSettingsChange || isDashboardLinkChange || source === "local") {
				await syncAppSettings(connection, organization, state);
			}

			if (isCategoryChange || source === "local") {
				await syncAiRules(connection, organization.id, state.aiRules || {});
				await syncCategories(connection, organization.id, state.categories || []);
			} else {
				// Intentionally do not sync suggestions here.
				// Suggestions are written via public submission, status updates, or deletes.
			}
		}

		if (isReportChange) {
			await syncReportHistory(connection, organization.id, Number(payload.adminId || 0), state.reportHistory || []);
		}
		await connection.commit();

		// For public submissions, reload from DB so the renderer gets authoritative
		// AI category + confidence values (not client guesses).
		if (isSuggestionSubmit) {
			const loadedState = await loadAdminState(pool, { orgId: organization.id });
			if (!loadedState.ok) {
				return loadedState;
			}
			return {
				...loadedState,
				message: "Suggestion saved and categorized."
			};
		}

		return {
			ok: true,
			state: {
				...state,
				organizationId: organization.id,
				organizationName: organization.name,
				organizationSlug: organization.slug,
				organizationAccentColor: state.previewAccent || organization.accent_color,
				generatedSlug: String(state.generatedSlug || organization.generated_slug || organization.active_link_slug || organization.slug || "computer-society-g8k2").trim(),
				previewAccent: String(state.previewAccent || organization.preview_accent || organization.accent_color || "#008080").trim(),
				publicNote: String(state.publicNote || organization.public_note || "").trim()
			}
		};
	} catch (error) {
		await connection.rollback();
		return {
			ok: false,
			message: error instanceof Error ? error.message : "Unable to save application state."
		};
	} finally {
		connection.release();
	}
}

async function saveSuggestionStatus(pool, payload = {}) {
	const organization = await resolveOrganizationContext(pool, payload);
	if (!organization) {
		return {
			ok: false,
			message: "Unable to resolve the current organization."
		};
	}

	const connection = await pool.getConnection();
	try {
		await connection.beginTransaction();
		const updateResult = await updateSuggestionStatus(connection, organization.id, payload.suggestionId, payload.status);
		if (!updateResult.ok) {
			await connection.rollback();
			return updateResult;
		}

		await connection.commit();
		const loadedState = await loadAdminState(pool, { orgId: organization.id });
		if (!loadedState.ok) {
			return loadedState;
		}

		return {
			...loadedState,
			message: updateResult.message || "Suggestion status updated."
		};
	} catch (error) {
		await connection.rollback();
		return {
			ok: false,
			message: error instanceof Error ? error.message : "Unable to update suggestion status."
		};
	} finally {
		connection.release();
	}
}

async function deleteSuggestion(connection, orgId, suggestionId) {
	const numericSuggestionId = Number(suggestionId || 0);
	if (!Number.isFinite(numericSuggestionId) || numericSuggestionId <= 0) {
		return {
			ok: false,
			message: "Missing suggestion identifier."
		};
	}

	const existing = await fetchSingleRow(
		connection,
		`SELECT id FROM suggestions WHERE org_id = ? AND id = ? LIMIT 1`,
		[orgId, numericSuggestionId]
	);

	if (!existing) {
		return {
			ok: false,
			message: "Suggestion not found."
		};
	}

	await connection.execute(
		`DELETE FROM suggestions WHERE id = ? AND org_id = ?`,
		[numericSuggestionId, orgId]
	);

	return {
		ok: true,
		message: "Suggestion deleted."
	};
}

async function saveSuggestionDelete(pool, payload = {}) {
	const organization = await resolveOrganizationContext(pool, payload);
	if (!organization) {
		return {
			ok: false,
			message: "Unable to resolve the current organization."
		};
	}

	const connection = await pool.getConnection();
	try {
		await connection.beginTransaction();
		const deleteResult = await deleteSuggestion(connection, organization.id, payload.suggestionId);
		if (!deleteResult.ok) {
			await connection.rollback();
			return deleteResult;
		}

		await connection.commit();
		const loadedState = await loadAdminState(pool, { orgId: organization.id });
		if (!loadedState.ok) {
			return loadedState;
		}

		return {
			...loadedState,
			message: deleteResult.message || "Suggestion deleted."
		};
	} catch (error) {
		await connection.rollback();
		return {
			ok: false,
			message: error instanceof Error ? error.message : "Unable to delete suggestion."
		};
	} finally {
		connection.release();
	}
}

module.exports = {
	loadAdminState,
	saveAdminState,
	saveSuggestionStatus,
	saveSuggestionDelete,
	resolveOrganizationContext,
	// exported for IPC preview in AI Categories simulator
	previewAiClassification: async (pool, payload = {}) => {
		const organization = await resolveOrganizationContext(pool, payload);
		if (!organization) {
			return { ok: false, message: "Unable to resolve the current organization." };
		}

		const text = String(payload.text || "").trim();
		if (!text) {
			return { ok: true, result: { category: "Uncategorized", confidence: 0 } };
		}

		const connection = await pool.getConnection();
		try {
			// Call Python AI classifier API for preview (same as real classification)
			const response = await fetch("http://localhost:8001/test", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					text,
					org_id: organization.id
				})
			});

			if (!response.ok) {
				return { ok: false, message: "AI classifier is unavailable." };
			}

			const data = await response.json();
			return {
				ok: true,
				result: {
					category: data.category || "Uncategorized",
					confidence: Math.round(data.confidence || 0)
				}
			};
		} catch (err) {
			return { ok: false, message: "Unable to reach AI classifier." };
		} finally {
			connection.release();
		}
	}
};
