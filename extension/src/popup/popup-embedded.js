(function () {
  var params = new URLSearchParams(location.search);
  if (params.get("embedded") === "1" || window.parent !== window) {
    document.documentElement.dataset.embedded = "1";
  }
})();
