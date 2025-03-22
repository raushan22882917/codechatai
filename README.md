# CodeTest AI

An AI-powered VS Code extension for intelligent test case generation and code assistance.

![CodeTest AI](resources/verichat-icon.png)
see our extension:(https://marketplace.visualstudio.com/items?itemName=codetestai.codetestai)

## Features

### 🧪 AI-Powered Test Generation
- Automatically generates up to 10 test cases for your code
- Supports multiple test categories (unit tests, edge cases, performance tests)
- Real-time test generation as you code
- Smart file tracking across editor tabs

### 💬 AI Chat Interface
- Chat with AI about your code
- Get instant code suggestions and improvements
- Accept or reject code suggestions directly
- Code block support with syntax highlighting

### ⚡ Quick Actions
- Generate tests with `Ctrl+Shift+T` / `Cmd+Shift+T`
- Run tests with `Ctrl+Shift+R` / `Cmd+Shift+R`
- Accept suggestions with `Ctrl+Shift+A` / `Cmd+Shift+A`
- Reject suggestions with `Ctrl+Shift+X` / `Cmd+Shift+X`
- Open chat with `Ctrl+Shift+C` / `Cmd+Shift+C`
- Debug tests with `Ctrl+Shift+D` / `Cmd+Shift+D`

### 🎯 Smart Test Management
- Modern tabbed interface
- Test case categorization
- Status indicators (pending/passed/failed)
- Code preview in formatted blocks
- Accept/reject functionality

### 🔄 Real-Time Updates
- Auto-detection of code changes
- Progress indicators
- Clear error notifications
- Success/failure status for each operation

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "CodeTest AI"
4. Click Install

## Usage

1. Open a code file in VS Code
2. Click the CodeTest AI icon in the activity bar
3. Choose between Test Cases or AI Chat tabs
4. Start generating tests or chatting with AI about your code

### Auto-Detection Mode

1. Enable auto-detection using the toggle switch
2. Tests will be generated automatically as you code
3. View real-time status updates in the status bar
4. Accept or reject generated tests

### Manual Mode

1. Select the code you want to test
2. Press `Ctrl+Shift+T` to generate tests
3. Review and modify generated tests
4. Run tests with `Ctrl+Shift+R`

## Requirements

- VS Code version 1.85.0 or higher
- Node.js 18.x or higher

## Extension Settings

* `codetestai.autoDetect`: Enable/disable automatic test generation
* `codetestai.maxTestCases`: Maximum number of test cases to generate (default: 10)
* `codetestai.showStatusBar`: Show/hide status bar item

## Known Issues

Please report any issues on our [GitHub repository](https://github.com/codetestai/codetestai/issues).

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
