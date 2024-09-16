// File: main.js
(function () {
    const vscode = acquireVsCodeApi();

    const fileListElement = document.getElementById('fileList');
    const combineButton = document.getElementById('combineButton');

    let files = [];
    let currentPath = '';

    combineButton.addEventListener('click', () => {
        const selectedFiles = files.filter(file => file.selected && !file.isDirectory).map(file => file.path);
        if (selectedFiles.length > 0) {
            vscode.postMessage({ type: 'combine', files: selectedFiles });
        } else {
            vscode.postMessage({ type: 'showMessage', message: 'No files selected' });
        }
    });

    function createFileTree(files) {
        const tree = {};
        files.forEach(file => {
            const relativePath = file.path.replace(currentPath, '').split('\\').filter(Boolean);
            let current = tree;
            relativePath.forEach((part, index) => {
                if (!current[part]) {
                    current[part] = index === relativePath.length - 1
                        ? { ...file, name: part, children: {} }
                        : { name: part, children: {}, isDirectory: true, path: file.path };
                }
                current = current[part].children;
            });
        });
        return tree;
    }

    function renderFileTree(tree, parent = fileListElement, level = 0) {
        parent.innerHTML = '';

        if (level === 0 && currentPath !== '') {
            const backElement = document.createElement('div');
            backElement.className = 'file-item';
            backElement.innerHTML = '<span class="codicon codicon-arrow-left"></span> ..';
            backElement.addEventListener('click', () => {
                vscode.postMessage({ type: 'goBack' });
            });
            parent.appendChild(backElement);
        }

        for (const [name, item] of Object.entries(tree)) {
            const fileElement = document.createElement('div');
            fileElement.className = 'file-item';
            fileElement.style.paddingLeft = `${level * 20}px`;

            const icon = document.createElement('span');
            icon.className = 'codicon';
            icon.classList.add(item.isDirectory ? 'codicon-folder' : 'codicon-file');
            icon.setAttribute('aria-hidden', 'true');

            const label = document.createElement('span');
            label.textContent = name;
            label.className = 'file-label';

            fileElement.appendChild(icon);
            fileElement.appendChild(label);

            if (!item.isDirectory) {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'file-checkbox';
                checkbox.id = `checkbox-${item.path}`;
                checkbox.checked = item.selected || false;
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation(); // Prevent folder from opening when clicking checkbox
                    item.selected = checkbox.checked;
                    // Update the files array
                    const fileIndex = files.findIndex(f => f.path === item.path);
                    if (fileIndex !== -1) {
                        files[fileIndex].selected = checkbox.checked;
                    }
                });

                const checkboxLabel = document.createElement('label');
                checkboxLabel.htmlFor = `checkbox-${item.path}`;
                checkboxLabel.className = 'checkbox-label';

                fileElement.appendChild(checkboxLabel);
                fileElement.appendChild(checkbox);
            }

            parent.appendChild(fileElement);

            if (item.isDirectory) {
                fileElement.addEventListener('click', (e) => {
                    // Open directory only if the click is not on a child element
                    if (e.target === fileElement || e.target === icon || e.target === label) {
                        vscode.postMessage({ type: 'openDirectory', path: item.path });
                    }
                });
            }
        }
    }

    function updateFileList(files, path) {
        currentPath = path;
        const tree = createFileTree(files);
        renderFileTree(tree);
    }

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'updateFileList':
                files = message.files;
                updateFileList(files, message.currentPath);
                break;
        }
    });
})();