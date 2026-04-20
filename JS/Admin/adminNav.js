(function () {
	const navLinks = Array.from(document.querySelectorAll(".admin-nav .admin-nav-item[href]"));
	if (!navLinks.length) {
		return;
	}

	const currentPath = window.location.pathname.replace(/\\/g, "/").toLowerCase();
	const currentFile = currentPath.split("/").pop() || "";

	function setActiveLink(activeLink) {
		navLinks.forEach((link) => {
			link.classList.toggle("is-active", link === activeLink);
		});
	}

	const matchedLink = navLinks.find((link) => {
		const href = (link.getAttribute("href") || "").toLowerCase();
		const hrefFile = href.split("/").pop() || "";
		return hrefFile === currentFile;
	});

	if (matchedLink) {
		setActiveLink(matchedLink);
	}

	navLinks.forEach((link) => {
		link.addEventListener("click", () => {
			setActiveLink(link);
		});
	});
})();
