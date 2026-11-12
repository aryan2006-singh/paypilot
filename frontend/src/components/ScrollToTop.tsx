import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Hash routing keeps the scroll position between pages; reset it on navigation. */
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
