import React, { useCallback, useEffect, useRef, useState } from "react";

import parseDocument, { hasText } from "./parseDocument";

function getToday() {
  return new Date().toLocaleDateString("de-CH");
}

const header = `
<?xml version="1.0" encoding="UTF-8"?>
<?xml-model href="https://gams.uni-graz.at/o:hsa.odd/RNG" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>
<?xml-model href="https://gams.uni-graz.at/o:hsa.odd/RNG" type="application/xml" schematypens="http://purl.oclc.org/dsdl/schematron"?>
`.trim();

const Tag = ({ tag, attr, children, level, forceMulti, forceInline }) => {
  if (!children && !forceMulti) {
    const classes = `self-tag ${forceInline ? "inline" : ""}`;
    return (
      <div className={classes}>&lt;{tag}{attr ? ` ${attr}` : ""} /&gt;</div>
    );
  }

  if (children.length === 1 && !forceMulti) {
    const classes = `inline-tag ${forceInline ? "inline" : ""}`;
    return (
      <div className={classes}>&lt;{tag}{attr ? ` ${attr}` : ""}&gt;{children}&lt;/{tag}&gt;</div>
    );
  }
  const classes = `tag ${forceInline ? "inline" : ""}`;
  return (
    <div className={classes}>
      &lt;{tag}{attr ? ` ${attr}` : ""}&gt;
        <div className="tag-content">
          {children}
        </div>
      &lt;/{tag}&gt;
    </div>
  );
};

const Node = ({ doc, isFirst, node, level }) => {
  if (typeof node === "string") {
    return node.trim();
  }

  const isRoot = doc === node;

  let children;
  if (node.children) {
    let isFirst = level === 0;
    children = node.children.map((child, n) => {
      let thisFirst = false;
      if (child.alignment !== "right") {
        thisFirst = isFirst;
        isFirst = false;
      }

      let closer;
      if (doc === node && doc.closer && doc.closer.index === n) {
        closer = (
          <Tag tag="closer">
            {doc.closer.salute && <Tag tag="salute"><Node doc={doc} isFirst={false} level={1 + level} node={doc.closer.salute} /></Tag>}
            {doc.closer.salute && doc.closer.signed && <Tag tag="lb" />}
            {doc.closer.signed && <Tag tag="signed"><Node doc={doc} isFirst={false} level={1 + level} node={doc.closer.signed} /></Tag>}
          </Tag>
        );
      }

      return (
        <>
          {closer}
          <Node key={n} isFirst={thisFirst} doc={doc} node={child} level={1 + n} />
        </>
      );
    });
  }

  if (node.type === "postscript") {
    return (
      <Tag tag="postscript" forceMulti>{children}</Tag>
    );
  }

  if (node.type === "document") {
    return (
      <div className="doc-node">
        {header}
        <p className="n0">&lt;!--encoded body of letter {doc.docNumber || ""}_, {localStorage.user}, last edit {getToday()}--&gt;</p>
        <Tag tag="TEI" attr={`xmlns="http://www.tei-c.org/ns/1.0"`}>
          <Tag tag="teiHeader">
            <Tag tag="fileDesc">
              <Tag tag="titleStmt">
                <Tag tag="title">Title</Tag>
              </Tag>

              <Tag tag="publicationStmt">
                <Tag tag="p">Publication Information</Tag>
              </Tag>

              <Tag tag="sourceDesc">
                <Tag tag="p">{doc.source}</Tag>
              </Tag>

            </Tag>
          </Tag>

          <Tag tag="text">
            <Tag tag="body">
              <Tag tag="div" attr={`type="letter" subtype="original" xml:lang="de"`}>
                <Tag tag="pb" attr={`n="1"`} />

                {children}

              </Tag>
            </Tag>
          </Tag>
        </Tag>
      </div>
    );
  }

  // It's probably either the place or the date
  if (node.type === "paragraph" && node.alignment === "right") {
    return (
      <div className="paragraph-node">
        <Tag tag="dateline">{children}</Tag>
      </div>
    );
  }

  if (isFirst) {
    return (
      <div className="paragraph-node">
        <Tag tag="opener">{children}</Tag>
      </div>
    );
  }

  if (node.type === "paragraph") {
    return (
      <div className="paragraph-node">
        <Tag tag="p" forceMulti>
          {children}
        </Tag>
      </div>
    );
  }

  if (node.isFootnote) {
    const attr = `type="editorial" place="foot" n="${node.footnoteNumber}"`;
    return (
      <Tag tag="note" attr={attr} forceInline>
        {node.footnotes.map((x) => <Node doc={doc} node={x} />)}
      </Tag>
    );
  }

  if (node.type === "run") {
    if (node.highlight && node.children.length === 1 && node.children[0].isFootnote) {
      // Don't render footnotes as persName, etc.
    } else if (node.highlight === "green") {
      return (
        <Tag forceInline tag="persName" attr={`ref="#"`}>{children}</Tag>
      );
    } else if (node.highlight === "red") {
      return (
        <Tag forceInline tag="todo" attr={`ref="#"`}>{children}</Tag>
      );
    } else if (node.highlight === "cyan") {
      return (
        <Tag forceInline tag="placeName" attr={`ref="#"`}>{children}</Tag>
      );
    } else if (node.highlight) {
      console.warn("Found unhandled highlight", node.highlight);
    }

    if (node.isItalic && hasText(node)) {
      return (
        <Tag forceInline tag="hi" attr={`rendition="#none" rend="unknown"`}>{children}</Tag>
      );
    }

    return (
      <span className="run-node">
        {children}
      </span>
    );
  }

  if (node.type === "text") {
    return node.value;
  }

  console.error("Unexpected node", node.type);
  return null;
};

export default ({ name, content }) => {
  const [doc, setDoc] = useState(() => "");
  const preRef = useRef(null);
  const [isCopied, setIsCopied] = useState(false);

  const copy = useCallback((e) => {
    e.preventDefault();
    const text = preRef.current.innerText;

    const temp = document.createElement("PRE");
    temp.opacity = 0;
    temp.position = "absolute";
    temp.innerText = text;
    document.body.appendChild(temp);

    try {
      const range = document.createRange();
      range.selectNode(temp);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      const success = document.execCommand("copy");
      if (success) {
        setIsCopied(true);
        setTimeout(() => {
          setIsCopied(() => false);
        }, 2000);
      }
    } catch (err) { // eslint-disable-line
      // Do nothing
    } finally {
      document.body.removeChild(temp);
    }
  }, [setIsCopied]);

  useEffect(() => {
    parseDocument(name, content)
      .then((res) => {
        setDoc(res);
      });
  }, [setDoc]);

  return (
    <>
      <a href="#" onClick={copy} id="copy">{isCopied ? "copied!" : "copy to clipboard"}</a>
      <pre id="output" ref={preRef}>
        <Node doc={doc} node={doc} level={0} />
      </pre>
    </>
  );
};
