export const getFilenameFromUrl = (url) => {
  const posOfLastSlash = url.lastIndexOf("/");
  if (posOfLastSlash === -1) return url;

  if (posOfLastSlash === url.length - 1) {
    return getFilenameFromUrl(url.subst(0, url.length - 1));
  }

  return url.substring(posOfLastSlash + 1);
};

/**
* Helper method for elements creation
*
* @param {string} tagName
* @param {array} classNames
* @param {object} attributes
* @return {HTMLElement}
*/
export const make = (tagName:string, classNames:string[], attributes = {}) => {
  // eslint-disable-next-line no-undef
  const el = document.createElement(tagName);

  el.classList.add(...classNames.filter((className) => className.length > 0));

  // eslint-disable-next-line guard-for-in
  for (const attrName in attributes) {
    el[attrName] = attributes[attrName];
  }

  return el;
};