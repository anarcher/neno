const getKeySortFunction = function(
  key: string | number,
  doCaseInsensitiveSort: boolean,
) {
  return function(a, b):number {
    let x = a[key];
    let y = b[key];

    if (doCaseInsensitiveSort && (typeof x === "string")) {
      x = x.toLowerCase();
      y = y.toLowerCase();
    }

    return ((x < y) ? -1 : ((x > y) ? 1 : 0));
  };
};


/*
  @function binaryArrayFind:
    This function performs a binary search in an array of objects that is
    sorted by a specific key in the objects.

  @param sortedArray:
    An array of objects that is sorted by a specific key in the objects.
  @param sortKeyKey:
    They key of the object whose corresponding value is the sort key for
    that object.
  @param sortKeyToFind:
    The sort key we want to find.
*/
function binaryArrayFind<T> (
  sortedArray:T[],
  sortKeyKey: string | number,
  sortKeyToFind: number | string,
): T | null {
  let start = 0;
  let end = sortedArray.length - 1;

  while (start <= end) {
    // Find the mid index
    const mid = Math.floor((start + end) / 2);

    // If element is present at mid, return it
    if (sortedArray[mid][sortKeyKey] === sortKeyToFind) {
      return sortedArray[mid];
    // Else look in left or right half accordingly
    } else if (sortedArray[mid][sortKeyKey] < sortKeyToFind) {
      start = mid + 1;
    } else {
      end = mid - 1;
    }
  }

  return null;
}


function binaryArrayFindIndex(
  sortedArray: any[],
  sortKeyKey: string | number,
  sortKeyToFind: string | number,
): number {
  let start = 0;
  let end = sortedArray.length - 1;

  while (start <= end) {
    // Find the mid index
    const mid = Math.floor((start + end) / 2);

    // If element is present at mid, return index
    if (sortedArray[mid][sortKeyKey] === sortKeyToFind) {
      return mid;
    // Else look in left or right half accordingly
    } else if (sortedArray[mid][sortKeyKey] < sortKeyToFind) {
      start = mid + 1;
    } else {
      end = mid - 1;
    }
  }

  return -1;
}


/*
  @function binaryArrayIncludes:
    This function performs a binary search in the manner of Array.includes()
    in an array of values that has been sorted with Array.sort().

  @param sortedArray:
    An array of values that is sorted with Array.sort()
  @param valueToLookFor:
    The value we want to find.
*/
const binaryArrayIncludes = function(sortedArray, valueToLookFor) {
  let start = 0;
  let end = sortedArray.length - 1;

  while (start <= end) {
    // Find the mid index
    const mid = Math.floor((start + end) / 2);

    // If element is present at mid, we have it
    if (sortedArray[mid] === valueToLookFor) {
      return true;
    // Else look in left or right half accordingly
    } else if (sortedArray[mid] < valueToLookFor) {
      start = mid + 1;
    } else {
      end = mid - 1;
    }
  }

  return false;
};


const cloneObject = function(obj):any {
  let clone = {};

  if (Array.isArray(obj)) {
    clone = [];
  }

  for (const i in obj) {
    if (obj[i] && typeof obj[i] === "object") {
      clone[i] = cloneObject(obj[i]);
    } else {
      clone[i] = obj[i];
    }
  }

  return clone;
};


const yyyymmdd = (date) => {
  const yyyy = date.getFullYear().toString();
  const mm = (date.getMonth() + 1).toString(); // getMonth() is zero-based
  const dd = date.getDate().toString();
  return (
    yyyy + "-" + (mm[1] ? mm : "0" + mm[0]) + "-" + (dd[1] ? dd : "0" + dd[0])
  );
};


const unescapeHTML = (str: string):string => {
  const htmlEntities = {
    nbsp: " ",
    cent: "¢",
    pound: "£",
    yen: "¥",
    euro: "€",
    copy: "©",
    reg: "®",
    lt: "<",
    gt: ">",
    quot: "\"",
    amp: "&",
    apos: "'",
  };

  return str.replace(/&([^;]+);/g, function(entity, entityCode) {
    let match;

    if (entityCode in htmlEntities) {
      return htmlEntities[entityCode];
      /* eslint no-cond-assign: 0*/
    } else if (match = entityCode.match(/^#x([\da-fA-F]+)$/)) {
      return String.fromCharCode(parseInt(match[1], 16));
      /* eslint no-cond-assign: 0*/
    } else if (match = entityCode.match(/^#(\d+)$/)) {
      return String.fromCharCode(~~match[1]);
    } else {
      return entity;
    }
  });
};


const deepFreeze = (o) => {
  Object.freeze(o);
  if (o === undefined) {
    return o;
  }

  Object.getOwnPropertyNames(o).forEach(function (prop) {
    if (o[prop] !== null
    && (typeof o[prop] === "object" || typeof o[prop] === "function")
    && !Object.isFrozen(o[prop])) {
      deepFreeze(o[prop]);
    }
  });

  return o;
};


function isNotEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined;
}


function isNotFalse<TValue>(value: TValue | false): value is TValue {
  return value !== false;
}


const getPagedMatches = <T>(
  allMatches: Array<T>,
  page:number,
  rows:number,
):Array<T> => {
  const startIndex = (page - 1) * rows;

  if (allMatches.length < startIndex) {
    return [];
  } else {
    const allMatchesFromThisPageOn = allMatches.slice(startIndex);

    if (allMatchesFromThisPageOn.length > rows) {
      return allMatches.slice(startIndex, startIndex + rows);
    } else {
      return allMatchesFromThisPageOn;
    }
  }
};


const stringContainsUUID = (string) => {
  return Array.isArray(
    string.match(
      /\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b/g,
    )
  );
}

export {
  getKeySortFunction,
  binaryArrayFind,
  binaryArrayFindIndex,
  binaryArrayIncludes,
  cloneObject,
  yyyymmdd,
  unescapeHTML,
  deepFreeze,
  isNotEmpty,
  isNotFalse,
  getPagedMatches,
  stringContainsUUID,
};
