const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

class FileCombinerViewProvider {
	constructor(extensionUri) {
		this._extensionUri = extensionUri;
		this._view = undefined;
		this._currentPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
	}

	resolveWebviewView(webviewView) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				case 'combine':
					this._combineFiles(data.files);
					break;
				case 'openDirectory':
					this._currentPath = data.path;
					this._updateFileList();
					break;
				case 'goBack':
					this._currentPath = path.dirname(this._currentPath);
					this._updateFileList();
					break;
				case 'showMessage':
					vscode.window.showInformationMessage(data.message);
					break;
			}
		});

		this._updateFileList();
	}

	_updateFileList() {
		if (this._view) {
			const files = this._getFilesInDirectory(this._currentPath);
			this._view.webview.postMessage({ type: 'updateFileList', files, currentPath: this._currentPath });
		}
	}

	_getFilesInDirectory(dir) {
		const files = fs.readdirSync(dir, { withFileTypes: true });
		return files.map(file => ({
			name: file.name,
			isDirectory: file.isDirectory(),
			path: path.join(dir, file.name)
		}));
	}

	_combineFiles(files) {
		if (files.length === 0) {
			vscode.window.showInformationMessage('No files selected');
			return;
		}

		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			vscode.window.showErrorMessage('No folder opened in workspace');
			return;
		}

		const combinedFolderPath = path.join(workspaceFolder.uri.fsPath, 'combined_files');
		if (!fs.existsSync(combinedFolderPath)) {
			fs.mkdirSync(combinedFolderPath);
		}

		const outputPath = path.join(combinedFolderPath, `combined_output_${Date.now()}.txt`);

		let combinedContent = '';
		for (const file of files) {
			try {
				const content = fs.readFileSync(file, 'utf8');
				combinedContent += `// File: ${path.basename(file)}\n${content}\n\n`;
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to read file: ${file}`);
				return;
			}
		}

		try {
			fs.writeFileSync(outputPath, combinedContent);
			vscode.window.showInformationMessage(`Combined ${files.length} files into ${outputPath}`);
		} catch (error) {
			vscode.window.showErrorMessage('Failed to write combined file');
		}
	}

	_getHtmlForWebview(webview) {
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="https://cdn.jsdelivr.net/npm/vscode-codicons/dist/codicon.css" rel="stylesheet">
				<title>File Combiner</title>
			</head>
			<body>
				<div id="buttons">
					<button id="combineButton">Combine Files</button>
				</div>
				<div id="fileList" role="tree"></div>
				<script src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}



function activate(context) {
	const provider = new FileCombinerViewProvider(context.extensionUri);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('fileCombinerView', provider)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('file-combiner.refresh', () => {
			provider._updateFileList();
		})
	);
}

function deactivate() { }

module.exports = {
	activate,
	deactivate
};