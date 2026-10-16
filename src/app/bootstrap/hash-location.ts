/** Keep route parameters inside the fragment on hosts without an SPA fallback. */
export const canonicalHashLocation = (href: string): string => {
  const url = new URL(href);
  const fragment = url.hash.slice(1) || "/play";
  const [routeAndSearch, ...anchor] = fragment.split("#");
  const queryIndex = routeAndSearch!.indexOf("?");
  const route =
    queryIndex < 0 ? routeAndSearch! : routeAndSearch!.slice(0, queryIndex);
  const search = new URLSearchParams(
    queryIndex < 0 ? "" : routeAndSearch!.slice(queryIndex + 1),
  );
  for (const [key, value] of url.searchParams)
    if (!search.has(key)) search.append(key, value);
  const aliases: Record<string, string> = {
    archive: "history",
    analysis: "history",
    minigames: "play",
  };
  const path = route.startsWith("/") ? route : `/${aliases[route] || route}`;
  return `${url.pathname}#${path}${search.size ? `?${search}` : ""}${anchor.length ? `#${anchor.join("#")}` : ""}`;
};
