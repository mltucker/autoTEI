import mammoth from "../vendor/mammoth.browser.js";

/**
 * name => Document
 *
 * @typedef {Object} Document
 * @param {String} type - One of "document", "paragraph", "run".
 * @param {Document[]} children - Nested structure.
 * @param {String} styleId
 * @param {String} styleName
 * @param {Boolean} isBold
 * @param {Boolean} isUnderline
 * @param {Boolean} isItalic
 * @param {Boolean} isStrikethrough
 * @param {Boolean} isAllCaps
 * @param {Boolean} isSmallCaps
 * @param {String} verticalAlignment - One of "baseline", 
 * @param {String} font
 * @param {Number} fontSize
 */
const cache = { };

function searchAndReplace(doc, predicate, mapper) {
  const { children } = doc;
  if (!children) {
    return;
  }

  for (let n = children.length - 1; n >= 0; n--) {
    const child = children[n];
    if (predicate(child)) {
      const newChild = mapper(child);
      if (Array.isArray(newChild)) {
        children.splice(n, 1, ...newChild);
      } else if (newChild) {
        children[n] = newChild;
      } else {
        children.splice(n, 1);
      }
    } else if (child.children) {
      searchAndReplace(child, predicate, mapper);
    }
  }
}

function extractText(node) {
  if (node.type === "text") {
    return node.value;
  }

  if (node.children) {
    return node.children.map(extractText).join("");
  }

  return "";
}

export function hasText(node) {
  const text = extractText(node);
  return !!(text && text.trim());
}

function isSalute(paragraph) {
  const text = extractText(paragraph);
  return /grüss|gruess|herzlich/i.test(text);
}

function isSigned(paragraph) {
  const text = extractText(paragraph);
  return /hugo|schuchardt|gaston|paris/i.test(text);
}

function processDocument(doc) {
  console.log({ doc });

  // Extract the source (from --> to)
  searchAndReplace(doc, (x) => x.alignment === "center", (node) => {
    let text = extractText(node);
    text = text.replace("à", "-->");
    if (/(\d+)\./.test(text)) {
      doc.docNumber = parseInt(RegExp.$1, 10);
    }
    text = text.replace(/^\d+\.\s*/, "");
    text = text.replace(/\[\d+\]/, ""); // TODO: where does footnote 1 go?
    doc.source = text;
    return null;
  });


  // Create footnotes. Within the body there are runs that look like [4], then
  // at the end of the letter there are footnotes with one run like [4] and
  // another with the content of the footnote.
  const footnotes = { };
  for (let n = doc.children.length - 1; n >= 0; n--) {
    const paragraph = doc.children[n];
    if (paragraph.alignment === "right") {
      break;
    }

    if (paragraph.children.length > 1 && paragraph.children[0].type === "run" && /^\s*\[(\d+)\]\s*$/.test(extractText(paragraph.children[0]))) {
      const footnoteNumber = RegExp.$1;
      if (footnoteNumber in footnotes) {
        console.warn("Already found footnote", footnoteNumber, paragraph);
        continue;
      }
      footnotes[footnoteNumber] = paragraph.children.slice(1);
      doc.children.splice(n, 1);
    }
  }
  console.log({ footnotes });

  for (const footnoteNumber in footnotes) {
    const footnoteContent = footnotes[footnoteNumber]; // array of nodes
    searchAndReplace(doc, (node) => {
      if (node.type !== "text") {
        return false;
      }

      const text = node.value;
      return text.includes(`[${footnoteNumber}]`);
    }, (node) => {
      const text = node.value;
      const index = text.indexOf(`[${footnoteNumber}]`);
      const beforeText = text.slice(0, index);
      const afterText = text.slice(index + footnoteNumber.length + 2);

      node.isFootnote = true;
      node.footnoteNumber = parseInt(footnoteNumber, 10);
      node.footnotes = footnoteContent;
      node.value = `[${footnoteNumber}]`;

      const arr = [];
      if (beforeText) {
        arr.push({ type: "text", value: beforeText });
      }
      arr.push(node);
      if (afterText) {
        arr.push({ type: "text", value: afterText });
      }
      return arr;
    });
  }

  // The closer is right-aligned
  const closerIndexes = [];
  const paragraphs = doc.children;
  for (let n = 0; n < paragraphs.length; n++) {
    const para = paragraphs[n];
    if (para.alignment === "right" && n > 2) {
      closerIndexes.push(n);
    }
  }

  if (closerIndexes.length === 0) {
    console.warn("No closer found. Expected 2 right-aligned paragraphs.");
  } else if (closerIndexes.length === 1) {
    console.warn("Just 1 closer found. Expected 2 right-aligned paragraphs.");
    const index = closerIndexes[0];
    const closer = paragraphs[index];
    if (isSalute(closer)) {
      pargraphs.splice(index, 1);
      doc.closer = {
        index,
        salute: extractText(closer),
        signed: null,
      };
    } else if (isSigned(closer)) {
      paragraphs.splice(index, 1);
      doc.closer = {
        index,
        salute: null,
        signed: extractText(closer),
      };
    } else {
      console.warn("Closer not recognized as salute or signed", closer);
    }
  } else if (closerIndexes.length === 2) {
    // This is expected
    const index = closerIndexes[0];
    const otherIndex = closerIndexes[1];
    const closer1 = paragraphs[index];
    const closer2 = paragraphs[otherIndex];
    if (isSalute(closer1) && isSigned(closer2)) {
      paragraphs.splice(otherIndex, 1);
      paragraphs.splice(index, 1);
      doc.closer = {
        index,
        salute: extractText(closer1),
        signed: extractText(closer2),
      };
    } else if (isSalute(closer2) && isSigned(closer1)) {
      paragraphs.splice(otherIndex, 1);
      paragraphs.splice(index, 1);
      doc.closer = {
        index,
        salute: extractText(closer2),
        signed: extractText(closer1),
      };
    } else {
      console.warn("Closers not recognized as salute/signed", closer1, closer2);
    }
  } else {
    console.warn("Too many closers found. Expected 2 right-aligned paragraphs.");
  }

  // Remove empty paragraphs
  searchAndReplace(doc, (x) => (x.type === "paragraph" && !extractText(x).trim()), (x) => null);

  // After the closer it's either the postscript
  if (closerIndexes.length > 0 && closerIndexes.length <= 2) {
    const postscript = doc.children.slice(closerIndexes[0]);
    doc.children.splice(closerIndexes[0], postscript.length, {
      type: "postscript",
      children: postscript,
    });
  }

  return doc;
}

/**
 * Parse a docx, producing an XML document.
 *
 * @property {String} name - Name of the uploaded docx document.
 * @property {String} content - The docx content as an array buffer.
 * @returns {Object} Document element.
 */
export default function parseDocument(name, content) {
  if (cache[name]) {
    return Promise.resolve(cache[name]);
  }

  return mammoth.parseDoc({ arrayBuffer: content })
    .then((res) => {
      const doc = processDocument(res.value);
      cache[name] = doc;
      return doc;
    });
}
