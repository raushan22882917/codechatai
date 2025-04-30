# Change Log

All notable changes to the "GenTestX" extension will be documented in this file.

## [2.7.0] - 2024-04-30

### Added
- Added automatic code selection to input box
- Added error detection and fix suggestions with accept/reject options
- Added revert button for code changes
- Added persistent terminal for test runs
- Added scrollable chat history that remains visible when scrolling up

### Improved
- Enhanced code analysis with automatic error detection
- Improved UI with better feedback for code fixes
- Better terminal integration with persistent sessions

## [2.6.0] - 2024-04-29

### Added
- Added modern chat input UI similar to Augment Agent
- Added automatic file detection and display with cancel option
- Added support for all programming languages (30+ languages)
- Added GenTestX icon in terminal when running code
- Added better terminal output formatting

### Changed
- Redesigned input box with improved UI and UX
- Enhanced file handling with automatic language detection
- Improved terminal integration with better command formatting
- Updated test runner to support more languages

## [2.5.0] - 2024-04-28

### Added
- Added line-by-line code analysis with bug detection
- Added automatic error detection with inline fix suggestions
- Added file selection and analysis with detailed diagnostics
- Added keyboard shortcuts for quick access to all features
- Added code action provider for applying suggested fixes
- Added diagnostic provider for showing errors and warnings

### Changed
- Updated README with new features and keyboard shortcuts
- Improved error handling and user feedback
- Enhanced code analysis with context-aware suggestions

## [2.4.0] - 2024-04-27

### Added
- Added dedicated Settings tab with form interface
- Added API key management with test functionality
- Added default mode and language settings
- Added ability to switch between Chat and Settings tabs

### Changed
- Improved UI with better organization of settings
- Enhanced user experience with direct API key testing
- Updated configuration options in package.json

## [2.1.2] - 2024-04-26

### Added
- Added improved API key management with validation
- Added "Get API Key" button that opens the Groq website
- Added more detailed documentation for API key setup

### Changed
- Changed API key retrieval to prioritize VS Code settings over environment variables
- Improved error messages for missing API keys

## [2.1.1] - 2024-04-26

### Added
- Added proper API key management with user prompts
- Added better documentation for API key setup

### Fixed
- Fixed "Invalid API Key" error during publishing
- Improved error handling for missing API keys

## [2.1.0] - 2024-04-26

### Added
- Added dropdown in input box to switch between Chat and GenTestx AI modes
- Added automatic language detection via Groq API

### Changed
- Removed language selection dropdown as it's no longer needed
- Removed "Analyze Current File" button in favor of automatic file detection
- Updated UI layout to be cleaner and more intuitive
- Improved chat interface with mode-specific placeholders

### Fixed
- Fixed various UI layout issues

## [2.0.4] - 2024-04-20

- Initial release of GenTestX with Groq AI integration
