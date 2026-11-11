// Dark is the default. Apply a saved light choice before first paint so the page never flashes.
document.documentElement.classList.add("js");
try {
  if (localStorage.getItem("theme") === "light") document.documentElement.dataset.theme = "light";
} catch (e) {}
