import { galleryProfile, galleryAspectRatio } from './gallery-profiles.mjs';
export { galleryAspectRatio } from './gallery-profiles.mjs';
/**
 * @typedef {{src:string,width:number,height:number}} ImageVariant
 * @typedef {{src?:string,url?:string,thumbnailUrl?:string,galleryUrl?:string,frameUrl?:string,srcset?:string,sizes?:string,width?:number,height?:number,alt?:string,presentation?:'icon'|'photo'|'render',mode?:'icon'|'photo'|'render',eager?:boolean,framed?:boolean,preserveColor?:boolean,brandLabel?:string,springLabel?:{series:string,force:string},variants?:ImageVariant[],galleryVariants?:ImageVariant[]}} GalleryImage
 * @typedef {{title:string,href?:string,image?:GalleryImage|null,placeholderLogo?:GalleryImage|null,kind?:string,metadata?:Array<{label?:string,value:unknown}>,attributes?:Record<string,unknown>,headingLevel?:number,previewImage?:GalleryImage|null,actions?:Array<{id:string,label:string}>,linkAttributes?:Record<string,unknown>}} GalleryCard
 */
const icons = {
  keycap: '<path d="m7 7 18 0 4 20H3L7 7Zm0 0 3 12h12l3-12M10 19 3 27m19-8 7 8"/>',
  keyboard: '<rect x="2" y="7" width="28" height="18" rx="2"/><path d="M6 11h2m4 0h2m4 0h2m4 0h2M6 15h2m4 0h2m4 0h2m4 0h2M6 20h2m4 0h10m3 0h1"/>',
  spring: '',
  lubricant: '<path d="M12 3h8v6l5 7v12H7V16l5-7V3Zm-1 16h10M12 7h8"/>',
  vendor: '<path d="M3 13h26L26 5H6l-3 8Zm2 0v15h22V13M12 28V18h8v10M3 13c0 4 6 4 6 0 0 4 7 4 7 0 0 4 7 4 7 0 0 4 6 4 6 0"/>',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/gu, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function safeUrl(value) {
  const url = String(value ?? '').trim();
  if (!url || /[\u0000-\u001f]/u.test(url) || /^(?:javascript|data|vbscript):/iu.test(url)) return '';
  if (/^(?:https?:\/\/|\/|#|\.\.?\/)/u.test(url)) return url;
  return '';
}

function attributesHtml(attributes) {
  return Object.entries(attributes ?? {}).map(([name, value]) => {
    if (!/^(?:data-[a-z0-9-]+|aria-[a-z0-9-]+|id|title|tabindex|role)$/u.test(name) || value == null || value === false) return '';
    return ` ${name}="${escapeHtml(value === true ? '' : value)}"`;
  }).join('');
}

function iconKind(kind) {
  if(kind==='material')return 'material';
  if (kind === 'pcb') return 'pcb';
  if (kind.startsWith('keycap') || kind === 'kit') return 'keycap';
  if (kind.startsWith('switch')) return 'switch';
  return Object.hasOwn(icons, kind) ? kind : 'switch';
}

function iconMarkup(kind) {
  const type = iconKind(kind);
  if (type === 'switch' || type === 'keycap' || type === 'pcb' || type === 'material') return '';
  if (type === 'spring') return '<img class="kl-placeholder-icon kl-spring-illustration" src="/ui/spring-illustration.webp" alt="" loading="lazy" decoding="async">';
  return `<svg class="kl-placeholder-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[type]}</svg>`;
}

/** Convert a published or Studio image to the shared card image contract.
 * @param {GalleryImage|null|undefined} image
 * @returns {GalleryImage|null}
 */
export function galleryImage(image, kind = 'switch') {
  if (!image) return null;
  const variants = (image.galleryVariants ?? image.variants ?? []).toSorted((a, b) => a.width - b.width);
  const first = variants[0];
  let src = image.galleryUrl ?? image.frameUrl ?? first?.src ?? image.url ?? image.thumbnailUrl ?? image.src;
  if (src?.startsWith('/media/')) {
    const url = new URL(src, 'http://keylog.local');
    if (url.searchParams.get('frame') === 'gallery') {
      url.searchParams.set('aspect', galleryAspectRatio(kind));
      src = url.pathname + url.search + url.hash;
    }
  }
  return {
    src,
    srcset: variants.map((variant) => `${safeUrl(variant.src)} ${Number(variant.width)}w`).join(', ') || image.srcset,
    sizes: image.sizes ?? '(min-width: 1200px) 25vw, (min-width: 700px) 33vw, 50vw',
    width: first?.width ?? image.width,
    height: first?.height ?? image.height,
    alt: image.alt ?? '',
    presentation: image.presentation ?? image.mode ?? (kind === 'vendor' ? 'icon' : kind === 'keyboard' ? 'photo' : 'render'),
    eager: image.eager === true,
    framed: image.framed === true || Boolean(image.galleryUrl || image.galleryVariants?.length),
    preserveColor: image.preserveColor === true,
    brandLabel: image.brandLabel,
    springLabel: image.springLabel,
  };
}

/** A manufacturer mark uses the approved source image without a gallery frame.
 * The adjacent heading owns its accessible name.
 * @param {GalleryImage|null|undefined} logo
 */
export function renderBrandMark(logo) {
  if (!logo) return '';
  const image = galleryImage({ ...logo, galleryUrl: undefined, galleryVariants: undefined }, 'vendor');
  const src = safeUrl(image?.src);
  if (!src) return '';
  const displayKey = logo.galleryUrl?.match(/[?&]display=([a-f0-9]+)/u)?.[1];
  const brandSrc = /^\/media\/[a-f0-9]{64}\?/u.test(src)
    ? `${src}&frame=brand&v=1${displayKey ? `&display=${displayKey}` : ''}` : src;
  return `<img class="k-brand-mark" src="${escapeHtml(brandSrc)}" alt="" aria-hidden="true"${image.width ? ` width="${Number(image.width)}"` : ''}${image.height ? ` height="${Number(image.height)}"` : ''} loading="lazy" decoding="async">`;
}

/**
 * @param {GalleryImage|null|undefined} image
 * @param {string} kind
 * @param {GalleryImage|null|undefined} placeholderLogo
 */
export function renderGalleryMedia(image, kind = 'switch', placeholderLogo = null) {
  const aspect = galleryAspectRatio(kind);
  const value = galleryImage(image, kind);
  const src = safeUrl(value?.src);
  const mode = src && ['icon', 'photo', 'render'].includes(value.presentation) ? value.presentation : 'icon';
  const imageHtml = src ? `<img src="${escapeHtml(src)}"${value.srcset ? ` srcset="${escapeHtml(value.srcset)}" sizes="${escapeHtml(value.sizes)}"` : ''}${value.width ? ` width="${Number(value.width)}"` : ''}${value.height ? ` height="${Number(value.height)}"` : ''} alt="${escapeHtml(value.alt)}" loading="${value.eager ? 'eager' : 'lazy'}" decoding="async">` : '';
  const logo = !src && iconKind(kind) !== 'switch' && placeholderLogo
    ? galleryImage({ ...placeholderLogo, galleryUrl: undefined, galleryVariants: undefined }, 'vendor') : null;
  const logoSrc = safeUrl(logo?.src);
  const logoHtml = logoSrc ? `<img class="kl-placeholder-logo" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(logo.alt)}" loading="lazy" decoding="async"${logo.preserveColor ? ' data-preserve-color="true"' : ''}>` : '';
  const forceParts = String(value?.springLabel?.force ?? '').match(/^(\d+(?:\.\d+)?)\s*(.*)$/u);
  const forceLabel = forceParts ? `${escapeHtml(forceParts[1])}<small class="kl-spring-unit">${escapeHtml(forceParts[2])}</small>` : escapeHtml(value?.springLabel?.force);
  const label = src && value.springLabel
    ? `<div class="kl-spring-label"><span class="kl-spring-series">${escapeHtml(value.springLabel.series).replace(/ (\d+)$/u, '\u00a0$1')}</span><strong class="kl-spring-force">${forceLabel}</strong></div>`
    : src && value.brandLabel ? `<span class="kl-brand-label">${escapeHtml(value.brandLabel)}</span>` : '';
  return `<div class="kl-media" data-gallery-profile="${galleryProfile(kind)}" data-gallery-kind="${iconKind(kind)}" data-gallery-aspect="${aspect}" data-media-kind="${mode}"${value?.framed ? ' data-preframed="true"' : ''}${value?.preserveColor ? ' data-preserve-color="true"' : ''}${value?.springLabel ? ' data-spring-label="true"' : ''}${label ? ' data-brand-label="true"' : ''}${src ? '' : ' data-placeholder="true"'} data-placeholder-kind="${iconKind(kind)}">${imageHtml}${src ? label : iconMarkup(kind) + logoHtml}</div>`;
}

/** One card structure for Astro output and the editable Studio gallery.
 * @param {GalleryCard} options
 */
export function renderGalleryCard({ title, href = '', image = null, placeholderLogo = null, kind = 'switch', metadata = [], attributes = {}, headingLevel = 3, previewImage = null, actions = [], linkAttributes = {} }) {
  const tag = headingLevel === 2 ? 'h2' : headingLevel === 3 ? 'h3' : 'strong';
  const metadataHtml = metadata.filter((field) => field.value != null && String(field.value).trim()).map((field) => `<div>${field.label ? `<dt>${escapeHtml(field.label)}</dt>` : ''}<dd>${escapeHtml(field.value)}</dd></div>`).join('');
  const preview = previewImage ? `<template data-gallery-preview>${renderGalleryMedia(previewImage, kind)}</template>` : '';
  const body = `${renderGalleryMedia(image, kind, placeholderLogo)}${preview}<div class="kl-card-copy"><${tag} class="kl-card-title">${escapeHtml(title)}</${tag}>${metadataHtml ? `<dl class="kl-card-fields">${metadataHtml}</dl>` : ''}</div>`;
  const destination = safeUrl(href);
  const link = destination ? `<a class="kl-card-link" href="${escapeHtml(destination)}"${attributesHtml(linkAttributes)}>${body}</a>` : `<div class="kl-card-link"${attributesHtml(linkAttributes)}>${body}</div>`;
  const menu = actions.length ? `<details class="kl-card-menu" data-action-menu><summary aria-label="${escapeHtml(title)} actions">⋯</summary><div>${actions.map((action) => `<button type="button" data-gallery-action="${escapeHtml(action.id)}">${escapeHtml(action.label)}</button>`).join('')}</div></details>` : '';
  return `<article class="kl-card"${attributesHtml(attributes)}>${link}${menu}</article>`;
}

const boundRoots = new WeakSet();
export function bindGalleryInteractions(root) {
  if (boundRoots.has(root)) return;
  boundRoots.add(root);
  // The containing scope follows dynamic Studio lists as well as server-rendered lists.
  const scopes = () => root.querySelectorAll('.kl-gallery').forEach((list) => list.parentElement.classList.add('kl-gallery-scope'));
  scopes();
  new MutationObserver(scopes).observe(root, { childList: true, subtree: true });
  const cardFrom = (target) => target instanceof Element ? target.closest('.kl-card') : null;
  function loadPreview(card) {
    const template = card.querySelector('template[data-gallery-preview]');
    if (!template) return;
    const media = template.content.firstElementChild.cloneNode(true);
    media.classList.add('kl-preview');
    const image = media.querySelector('img');
    if (image) {
      image.addEventListener('load', () => media.classList.add('is-loaded'), { once: true });
      image.loading = 'eager';
    }
    card.querySelector('.kl-media').append(media);
    template.remove();
    if (image?.complete && image.naturalWidth > 0) media.classList.add('is-loaded');
  }
  root.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch') return;
    const card = cardFrom(event.target);
    if (!card || card === cardFrom(event.relatedTarget)) return;
    card.dataset.galleryHovered = '';
    loadPreview(card);
  });
  root.addEventListener('pointerout', (event) => {
    const card = cardFrom(event.target);
    if (card && card !== cardFrom(event.relatedTarget)) delete card.dataset.galleryHovered;
  });
  root.addEventListener('focusin', (event) => {
    const card = cardFrom(event.target);
    if (card && event.target.matches(':focus-visible')) loadPreview(card);
  });
  function showImageFailure(image) {
    if (!(image instanceof HTMLImageElement) || !image.parentElement?.matches('.kl-media')) return;
    const media = image.parentElement;
    if (media.dataset.mediaError) return;
    image.remove();
    media.dataset.mediaError = 'true';
    const error = document.createElement('span');
    error.className = 'kl-media-error';
    error.setAttribute('role', 'status');
    error.textContent = 'Image unavailable';
    media.append(error);
    if (media.classList.contains('kl-preview')) media.classList.add('is-loaded');
  }
  root.addEventListener('error', (event) => showImageFailure(event.target), true);
  for (const image of root.querySelectorAll('.kl-media > img')) {
    if (image.complete && image.naturalWidth === 0) showImageFailure(image);
  }
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const menu = event.target instanceof Element ? event.target.closest('.kl-card-menu[open]') : null;
    if (menu) { event.preventDefault(); menu.open = false; menu.querySelector('summary').focus(); }
  });
}
