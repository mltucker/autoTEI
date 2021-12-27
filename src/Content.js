import React, { useEffect, useState } from "react";

import DocView from "./DocView";

export default ({ files }) => {
  const [index, setIndex] = useState(() => 0);

  const file = files[index];
  return (
    <div id="content">
      <div id="nav-back">&larr;</div>
      <DocView name={file.name} content={file.content} />
      <div id="nav-forward">&rarr;</div>
    </div>
  );
};
