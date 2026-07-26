const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

let initialized = false;

export const initAnalytics = () => {
  if (initialized || !MEASUREMENT_ID) {
    return;
  }

  initialized = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];

  // Must be a function declaration, not an arrow: it forwards `arguments`,
  // which arrow functions do not have. This is why Google's own snippet
  // uses `function` here.
  function gtag() {
    window.dataLayer.push(arguments);
  }

  window.gtag = gtag;

  gtag("js", new Date());

  // send_page_view: false because useAnalytics sends every page_view itself,
  // including the first. Leaving it on would double-count the landing page.
  gtag("config", MEASUREMENT_ID, { send_page_view: false });
};

export const trackPageView = (path) => {
  if (!MEASUREMENT_ID || typeof window.gtag !== "function") {
    return;
  }

  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
};

export const trackEvent = (name, params = {}) => {
  if (!MEASUREMENT_ID || typeof window.gtag !== "function") {
    return;
  }

  window.gtag("event", name, params);
};
