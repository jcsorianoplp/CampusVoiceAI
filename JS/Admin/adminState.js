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
		categories: [],
		reviewQueue: [],
		suggestions: [],
		publicFeed: [],
		reportConfig: {
			title: "Weekly Campus Voice Report",
			range: "30",
			audience: "Leadership",
			includeQueue: true,
			includeSentiment: true,
			includeCategories: true
		},
		reportHistory: [],
		publicNote: "",
		publicRange: "7",
		lastUpdated: null
	};

	let backendHydrationToken = 0;

	function getStateContext() {
		const orgId = Number(window.sessionStorage.getItem("campusvoice-admin-org-id") || "0");
		const adminId = Number(window.sessionStorage.getItem("campusvoice-admin-id") || "0");
		const url = new URL(window.location.href);
		const ref = String(url.searchParams.get("ref") || "").trim();

		return {
			orgId: Number.isFinite(orgId) && orgId > 0 ? orgId : 0,
			adminId: Number.isFinite(adminId) && adminId > 0 ? adminId : 0,
			ref
		};
	}

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

	function persistToBackend(state, source) {
		if (!window.campusVoiceDesktop?.saveAppState) {
			return;
		}

		const context = getStateContext();
		window.campusVoiceDesktop.saveAppState({
			...context,
			source: source || "local",
			state: clone(state)
		})
			.then((response) => {
				if (!response?.ok || !response.state) {
					return;
				}

				const nextState = mergeDeep(state, response.state);
				window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
				window.dispatchEvent(new CustomEvent(CHANGE_EVENT, {
					detail: {
						source: `${source || "local"}-saved`,
						state: clone(nextState)
					}
				}));
			})
			.catch(() => {});
	}

	function hydrateFromBackend() {
		if (!window.campusVoiceDesktop?.loadAppState) {
			return;
		}

		const context = getStateContext();
		const token = ++backendHydrationToken;

		window.campusVoiceDesktop.loadAppState(context)
			.then((response) => {
				if (token !== backendHydrationToken || !response?.ok || !response.state) {
					return;
				}

				let hydratedState = clone(response.state);
				try {
					const rawState = window.sessionStorage.getItem(STORAGE_KEY);
					if (rawState) {
						hydratedState = mergeDeep(response.state, JSON.parse(rawState));
					}
				} catch (error) {
					hydratedState = clone(response.state);
				}
				window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(hydratedState));
				window.dispatchEvent(new CustomEvent(CHANGE_EVENT, {
					detail: {
						source: "backend-load",
						state: clone(hydratedState)
					}
				}));
			})
			.catch(() => {});
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
		persistToBackend(nextState, source);
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
		hydrateFromBackend();

		return () => {
			window.removeEventListener(CHANGE_EVENT, handleChange);
		};
	}

	window.CampusVoiceAdminState = {
		defaultState: clone(DEFAULT_STATE),
		getState: loadState,
		setState: saveState,
		updateState,
		subscribe,
		reloadFromBackend: hydrateFromBackend
	};
})();
