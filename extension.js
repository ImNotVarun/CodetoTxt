const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

function activate(context) {
	let disposable = vscode.commands.registerCommand('file-combiner.openGUI', function () {
		const panel = vscode.window.createWebviewPanel(
			'fileCombiner',
			'File Combiner',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true
			}
		);

		panel.webview.html = getWebviewContent(panel);

		panel.webview.onDidReceiveMessage(
			async message => {
				switch (message.command) {
					case 'combineFiles':
						const files = message.files;
						const customFileName = message.fileName;

						if (!files || files.length === 0) {
							vscode.window.showInformationMessage('No files selected');
							return;
						}

						const workspaceFolders = vscode.workspace.workspaceFolders;
						if (!workspaceFolders) {
							vscode.window.showErrorMessage('No folder opened in workspace');
							return;
						}

						const rootPath = workspaceFolders[0].uri.fsPath;
						const combinedFolderPath = path.join(rootPath, 'combined_files');
						if (!fs.existsSync(combinedFolderPath)) {
							fs.mkdirSync(combinedFolderPath);
						}

						let baseName = customFileName || 'combined_output';
						let outputPath = path.join(combinedFolderPath, `${baseName}.txt`);
						let counter = 1;

						// Generate a unique file name
						while (fs.existsSync(outputPath)) {
							outputPath = path.join(combinedFolderPath, `${baseName}${counter}.txt`);
							counter++;
						}

						let combinedContent = '';
						for (const file of files) {
							try {
								const content = fs.readFileSync(file.path, 'utf8');
								combinedContent += `// File: ${file.name}\n${content}\n\n`;
							} catch (error) {
								vscode.window.showErrorMessage(`Failed to read file: ${file.name}`);
								return;
							}
						}

						try {
							fs.writeFileSync(outputPath, combinedContent);
							vscode.window.showInformationMessage(`Combined ${files.length} files into ${outputPath}`);
						} catch (error) {
							vscode.window.showErrorMessage('Failed to write combined file');
						}
						break;
				}
			},
			undefined,
			context.subscriptions
		);
	});

	context.subscriptions.push(disposable);
}

function getWebviewContent(panel) {
	const htmlPath = path.join(__dirname, 'webview.html');
	return fs.readFileSync(htmlPath, 'utf8');
}

function deactivate() { }

module.exports = {
	activate,
	deactivate
};
