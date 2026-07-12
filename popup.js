chrome.windows.create({
  url: 'monitor.html',
  type: 'popup',
  width: 360,
  height: 560,
  left: 100,
  top: 100
}, (newWindow) => {
  chrome.windows.update(newWindow.id, { focused: true }, () => {
    window.close();
  });
});
