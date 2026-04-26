(function () {
	const STORAGE_KEY = "campusvoice-admin-state";
	const CHANGE_EVENT = "campusvoice:admin-state-change";

	const DEFAULT_STATE = {
		generatedSlug: "computer-society-g8k2",
		previewAccent: "ocean",
		aiRules: {
			threshold: 80,
			uncertainQueue: true,
			publicSync: true,
			keywordBoost: true,
			testInput: ""
		},
		categories: [
			{
				name: "Campus Facilities",
				priority: "high",
				route: "Facilities Team",
				sla: "24h",
				confidence: 92,
				volume: 32,
				keywords: ["aircon", "projector", "lights"]
			},
			{
				name: "Student Life",
				priority: "medium",
				route: "Student Affairs",
				sla: "24h",
				confidence: 87,
				volume: 21,
				keywords: ["events", "clubs", "canteen"]
			},
			{
				name: "Academic Services",
				priority: "medium",
				route: "Academic Office",
				sla: "48h",
				confidence: 84,
				volume: 18,
				keywords: ["grading", "scheduling", "advising"]
			},
			{
				name: "Campus Safety",
				priority: "high",
				route: "Campus Security",
				sla: "12h",
				confidence: 79,
				volume: 13,
				keywords: ["gate", "crowd", "security"]
			}
		],
		reviewQueue: [
			{
				id: "rv-1",
				text: "Main gate is too crowded after 5 PM and feels unsafe.",
				predicted: "Student Life",
				confidence: 61
			},
			{
				id: "rv-2",
				text: "Need more quiet zones in the library for group projects.",
				predicted: "Academic Services",
				confidence: 66
			},
			{
				id: "rv-3",
				text: "Queue in canteen building B gets too long at lunch.",
				predicted: "Campus Facilities",
				confidence: 64
			}
		],
		suggestions: [
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
			},
			{
				time: "1 hour ago",
				category: "Admin Process",
				status: "resolved",
				statusLabel: "Resolved",
				sentiment: "Neutral",
				text: "Enrollment steps were a bit confusing. A clear checklist would help freshmen."
			},
			{
				time: "3 hours ago",
				category: "Campus Safety",
				status: "open",
				statusLabel: "Open",
				sentiment: "Negative",
				text: "The main gate gets overcrowded after the last class. Can we improve crowd flow?"
			},
			{
				time: "5 hours ago",
				category: "Academic Services",
				status: "progress",
				statusLabel: "In Progress",
				sentiment: "Neutral",
				text: "Could grading feedback be released a little faster after submissions?"
			},
			{
				time: "Yesterday",
				category: "Classroom",
				status: "resolved",
				statusLabel: "Resolved",
				sentiment: "Positive",
				text: "The projector in room 204 needs maintenance and better lighting would help."
			}
		],
		publicFeed: [
			{
				time: "Today",
				category: "Campus Facilities",
				status: "progress",
				statusLabel: "In Progress",
				text: "Library airflow concern moved to In Progress and posted in public status."
			},
			{
				time: "Yesterday",
				category: "Student Life",
				status: "open",
				statusLabel: "Acknowledged",
				text: "Activity-week suggestion acknowledged and published in summary update."
			},
			{
				time: "2 days ago",
				category: "Classroom",
				status: "done",
				statusLabel: "Resolved",
				text: "Projector issue marked resolved and reflected on the public dashboard."
			}
		],
		reportConfig: {
			title: "Weekly Campus Voice Report",
			range: "30",
			audience: "Leadership",
			includeQueue: true,
			includeSentiment: true,
			includeCategories: true
		},
		reportHistory: [
			{
				id: "rp-1",
				title: "Weekly Campus Voice Report",
				range: "30",
				audience: "Leadership",
				createdAt: "April 20, 2026 9:20 AM",
				suggestions: 6,
				resolvedRate: "33%"
			}
		],
		publicNote: "",
		publicRange: "7",
		lastUpdated: null
	};

	function clone(value) {
		if (typeof window.structuredClone === "function") {
			return window.structuredClone(value);
		}

		return JSON.parse(JSON.stringify(value));
	}

	function mergeDeep(base, incoming) {
		const result = clone(base);

		if (!incoming || typeof incoming !== "object") {
			return result;
		}

		Object.keys(incoming).forEach((key) => {
			const nextValue = incoming[key];
			if (Array.isArray(nextValue)) {
				result[key] = clone(nextValue);
				return;
			}

			if (nextValue && typeof nextValue === "object") {
				const currentValue = result[key];
				result[key] = mergeDeep(currentValue && typeof currentValue === "object" ? currentValue : {}, nextValue);
				return;
			}

			result[key] = nextValue;
		});

		return result;
	}

	function loadState() {
		try {
			const rawState = window.sessionStorage.getItem(STORAGE_KEY);
			if (!rawState) {
				return clone(DEFAULT_STATE);
			}

			return mergeDeep(DEFAULT_STATE, JSON.parse(rawState));
		} catch (error) {
			return clone(DEFAULT_STATE);
		}
	}

	function saveState(state, source) {
		const nextState = mergeDeep(DEFAULT_STATE, state);
		window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
		window.dispatchEvent(new CustomEvent(CHANGE_EVENT, {
			detail: {
				source: source || "local",
				state: clone(nextState)
			}
		}));
		return nextState;
	}

	function updateState(updater, source) {
		const currentState = loadState();
		const nextState = typeof updater === "function" ? updater(clone(currentState)) : mergeDeep(currentState, updater);
		return saveState(nextState, source);
	}

	function subscribe(listener) {
		if (typeof listener !== "function") {
			return () => {};
		}

		const handleChange = (event) => {
			listener(clone((event.detail && event.detail.state) || loadState()), event.detail || {});
		};

		window.addEventListener(CHANGE_EVENT, handleChange);
		window.addEventListener("storage", (event) => {
			if (event.key !== STORAGE_KEY) {
				return;
			}

			listener(loadState(), { source: "storage" });
		});

		listener(loadState(), { source: "init" });

		return () => {
			window.removeEventListener(CHANGE_EVENT, handleChange);
		};
	}

	window.CampusVoiceAdminState = {
		defaultState: clone(DEFAULT_STATE),
		getState: loadState,
		setState: saveState,
		updateState,
		subscribe
	};
})();
