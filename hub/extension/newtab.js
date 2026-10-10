chrome.storage.local.get("newtabOff").then(({ newtabOff }) => {
  if (newtabOff) {
    document.body.innerHTML = "";
    const f = document.createElement("form");
    f.action = "https://www.google.com/search";
    f.innerHTML = '<input name="q" autofocus placeholder="Search Google" style="width:min(560px,80vw);padding:14px 18px;border-radius:14px;border:1px solid #333;background:#151822;color:#fff;font-size:16px">';
    document.body.append(f);
  } else {
    location.replace("https://claude.ai/artifact/9aQgcMWmM7zPBkhuhRKbWu");
  }
});
