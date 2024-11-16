document.addEventListener('DOMContentLoaded', () => {
    // Load initial content
    loadSectionContent('task-content', 'task.html');

    function loadSectionContent(containerId, filePath) {
        fetch(filePath)
            .then(response => response.text())
            .then(html => {
                document.getElementById(containerId).innerHTML = html;
                if (containerId === 'task-content') {
                    initializeTaskFeatures();
                }
            });
    }
});
