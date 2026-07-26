import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { initAnalytics, trackPageView } from "../utils/analytics";

// GA4's snippet fires page_view once, on document load. React Router changes
// routes through the History API with no document load, so without this hook
// an entire session records a single pageview on "/". A GA report where all
// traffic sits on "/" and nowhere else is the signature of this bug.
function useAnalytics() {
  const location = useLocation();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    trackPageView(location.pathname + location.search);
    // Depend on the primitive fields, not `location` itself: React Router
    // hands back a fresh location object on every render even when the URL
    // has not changed, which would re-fire the event constantly.
  }, [location.pathname, location.search]);
}

export default useAnalytics;
