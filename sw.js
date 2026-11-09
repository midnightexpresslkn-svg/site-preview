self.addEventListener("fetch", function (event) {
  if (!event || !event.request || event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});
