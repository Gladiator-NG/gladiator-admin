import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

const MAIN_SCROLL_CONTAINER_ID = 'app-main-scroll-container';

function ScrollToTop() {
  const { pathname, search } = useLocation();

  useLayoutEffect(() => {
    const mainContainer = document.getElementById(MAIN_SCROLL_CONTAINER_ID);

    if (mainContainer) {
      mainContainer.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, search]);

  return null;
}

export default ScrollToTop;
export { MAIN_SCROLL_CONTAINER_ID };