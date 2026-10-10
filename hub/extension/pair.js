// Confirms a connect request from your Hub page. Only this button hands the Hub its code.
const qs = new URLSearchParams(location.search);
const tabId = Number(qs.get("tab")), frameId = Number(qs.get("frame")) || 0;
document.getElementById("no").onclick = () => window.close();
document.getElementById("yes").onclick = async () => {
  const r = await chrome.runtime.sendMessage({ type: "pairAllow", tabId, frameId }).catch(() => null);
  if (r && r.ok) window.close();
  else document.getElementById("note").textContent = "Couldn't find your Hub tab. Reload the Hub and press Connect again.";
};
document.getElementById("yes").focus();
