import React, { useCallback, useState } from "React";

import Content from "./Content";

export default () => {
  const [loading, setLoading] = useState(() => false);
  const [files, setFiles] = useState(() => []);

  const [user, setUser] = useState(() => localStorage.user || "");
  const changeUser = useCallback((e) => {
    setUser(e.target.value);
  }, [setUser]);
  const saveUser = useCallback((e) => {
    localStorage.user = user;
  }, [user]);

  const chooseFile = useCallback((e) => {
    setLoading(true);

    const input = e.target;
    for (let n = 0; n < input.files.length; n++) {
      const file = input.files[n];
      const reader = new FileReader();
      reader.onload = () => {
        setLoading(false);
        setFiles((arr) => [...arr, { name: file.name, content: reader.result }]);
      };
      reader.readAsArrayBuffer(file);
    }

  }, [setLoading, setFiles]);

  return (
    <div>

      <div id="title">

      </div>

      <div id="content">
        {files.length > 0 ? (
          <>
            <Content files={files} />
          </>
        ) : loading ? (
          <>
            Loading...
          </>
        ) : (
          <div id="main-form">
            <div id="main-form-content">
              <div id="logo">auto TEI</div>

              <p className="instructions">Who are you?</p>
              <input type="text" value={user} onChange={changeUser} onBlur={saveUser} id="user" placeholder="Your initials" />

              <p id="file-instructions">Choose docx file(s)...</p>

              <div id="file-container">
                <input
                  type="file"
                  id="file-input"
                  onChange={chooseFile}
                  accept=".docx"
                  multiple
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
