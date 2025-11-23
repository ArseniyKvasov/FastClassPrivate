function renderIntegrationTask(task, container) {
    if (!container) return;

    container.innerHTML = "";
    const integrationDiv = document.createElement("div");
    integrationDiv.className = "integration-content";

    if (task.data.embed_code) {
        integrationDiv.innerHTML = task.data.embed_code;

        const iframe = integrationDiv.querySelector('iframe');
        if (iframe) {
            iframe.style.width = '100%';
            iframe.style.maxWidth = '100%';
            iframe.style.border = 'none';
            iframe.style.borderRadius = '8px';
            iframe.style.minHeight = '400px';
        }
    } else {
        integrationDiv.innerHTML = `
            <div class="alert alert-warning text-center">
                <i class="bi bi-exclamation-triangle me-2"></i>
                Embed-код не загружен
            </div>
        `;
    }

    container.appendChild(integrationDiv);
}