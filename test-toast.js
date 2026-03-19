(function () {
  const style = document.createElement('style');
  style.textContent = `
    .db-toast {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      background: #1e1e2e;
      color: #cdd6f4;
      border-left: 4px solid #89b4fa;
      border-radius: 8px;
      padding: 12px 16px;
      min-width: 280px;
      max-width: 360px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      line-height: 1.4;
      opacity: 1;
      transition: opacity 0.4s ease, transform 0.4s ease;
      transform: translateX(0);
    }
    .db-toast.db-toast-hide {
      opacity: 0;
      transform: translateX(20px);
    }
    .db-toast-title {
      font-weight: 600;
      font-size: 13px;
      margin-bottom: 4px;
      color: #89b4fa;
    }
    .db-toast-message {
      color: #cdd6f4;
    }
    .db-toast-close {
      position: absolute;
      top: 8px;
      right: 10px;
      background: none;
      border: none;
      color: #6c7086;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      padding: 0;
    }
    .db-toast-close:hover {
      color: #cdd6f4;
    }
  `;
  document.head.appendChild(style);

  function showToast({ title, message, duration = 4000 }) {
    const toast = document.createElement('div');
    toast.className = 'db-toast';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'db-toast-close';
    closeBtn.title = 'Dismiss';
    closeBtn.textContent = '✕';

    const titleEl = document.createElement('div');
    titleEl.className = 'db-toast-title';
    titleEl.textContent = title;

    const msgEl = document.createElement('div');
    msgEl.className = 'db-toast-message';
    msgEl.textContent = message;

    toast.appendChild(closeBtn);
    toast.appendChild(titleEl);
    toast.appendChild(msgEl);
    document.body.appendChild(toast);

    const dismiss = () => {
      toast.classList.add('db-toast-hide');
      setTimeout(() => toast.remove(), 400);
    };

    closeBtn.addEventListener('click', dismiss);
    setTimeout(dismiss, duration);
  }

  // Test it
  showToast({
    title: 'PR Merged',
    message: 'feature/deployments-panel -> main by SurpriZez',
  });
})();
