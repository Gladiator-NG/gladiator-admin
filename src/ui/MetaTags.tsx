import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { buildAppUrl } from '../config/app';

const SITE_NAME = 'Gladiator Admin';
const DEFAULT_DESCRIPTION =
  'Gladiator Admin helps your team manage bookings, boats, transport locations, beach houses, and day-to-day operations in one place.';
const DEFAULT_IMAGE = '/gladiator_icon.png';

interface MetaTagsProps {
  title?: string;
  description?: string;
  image?: string;
  canonicalPath?: string;
  robots?: string;
}

function upsertMeta(
  attribute: 'name' | 'property',
  key: string,
  content: string,
) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  );

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(
    `link[rel="${rel}"]`,
  );

  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }

  element.setAttribute('href', href);
}

function MetaTags({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  canonicalPath,
  robots = 'noindex, nofollow',
}: MetaTagsProps) {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const documentTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
    const resolvedPath = canonicalPath ?? `${pathname}${search}`;
    const pageUrl = buildAppUrl(resolvedPath);
    const imageUrl = buildAppUrl(image);

    document.title = documentTitle;

    upsertMeta('name', 'description', description);
    upsertMeta('name', 'application-name', SITE_NAME);
    upsertMeta('name', 'apple-mobile-web-app-title', SITE_NAME);
    upsertMeta('name', 'robots', robots);
    upsertMeta('property', 'og:site_name', SITE_NAME);
    upsertMeta('property', 'og:title', documentTitle);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:url', pageUrl);
    upsertMeta('property', 'og:image', imageUrl);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', documentTitle);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', imageUrl);
    upsertLink('canonical', pageUrl);
  }, [canonicalPath, description, image, pathname, robots, search, title]);

  return null;
}

export default MetaTags;
