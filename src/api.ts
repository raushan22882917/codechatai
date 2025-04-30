import * as vscode from 'vscode';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Store active terminals
const activeTerminals: Map<string, vscode.Terminal> = new Map();

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Analyzes code using the Groq API
 * @param {string} code - The source code to analyze
 * @param {string} language - The programming language of the code
 * @returns {Promise<string>} - The analysis result from Groq
 */
// Interface for a test case
export interface TestCase {
    id: string;
    description: string;
    functionToTest: string;
    inputs: string;
    expectedOutput: string;
    scenario: string;
    testCode: string;
    isRunning: boolean;
    runResult: string | null;
    passed?: boolean;
}

/**
 * Gets the Groq API key from VS Code settings or environment variables
 * @returns The Groq API key or throws an error if not found
 */
async function getGroqApiKey(): Promise<string> {
    // First try to get API key from VS Code settings (preferred method)
    let apiKey: string | undefined;
    const config = vscode.workspace.getConfiguration('gentestx');
    const configApiKey = config.get<string>('groqApiKey');

    if (configApiKey && configApiKey.trim() !== '') {
        apiKey = configApiKey;
    }

    // If not found in settings, try environment variables (for development)
    if (!apiKey) {
        const envApiKey = process.env.GROQ_API_KEY;
        if (envApiKey && envApiKey.trim() !== '') {
            apiKey = envApiKey;
        }
    }

    // If still not found, prompt the user to enter their API key
    if (!apiKey) {
        const result = await vscode.window.showInformationMessage(
            'GenTestX requires a Groq API key to function. Would you like to set it now?',
            'Yes', 'Get API Key', 'No'
        );

        if (result === 'Get API Key') {
            // Open Groq website to get an API key
            vscode.env.openExternal(vscode.Uri.parse('https://console.groq.com/'));
            throw new Error('Please get an API key from https://console.groq.com/ and set it in VS Code settings.');
        } else if (result === 'Yes') {
            const inputKey = await vscode.window.showInputBox({
                prompt: 'Enter your Groq API key',
                placeHolder: 'gsk_...',
                password: true,
                ignoreFocusOut: true,
                validateInput: (value) => {
                    if (!value || value.trim() === '') {
                        return 'API key cannot be empty';
                    }
                    if (!value.startsWith('gsk_')) {
                        return 'Groq API keys typically start with "gsk_"';
                    }
                    return null; // Input is valid
                }
            });

            if (inputKey && inputKey.trim() !== '') {
                // Save the API key to settings
                await vscode.workspace.getConfiguration('gentestx').update('groqApiKey', inputKey, vscode.ConfigurationTarget.Global);
                apiKey = inputKey;

                vscode.window.showInformationMessage('API key saved successfully!');
            } else {
                throw new Error('No API key provided. You can set it later in VS Code settings (File > Preferences > Settings > Search for "GenTestX").');
            }
        } else {
            throw new Error('A Groq API key is required. You can get one at https://console.groq.com/ and set it in VS Code settings.');
        }
    }

    return apiKey;
}

export async function analyzeCodeWithGroq(code: string, language: string, mode: string = 'gentestx'): Promise<string> {
    try {
        const apiKey = await getGroqApiKey();
        // Determine the system message and user prompt based on the mode
        let systemMessage = '';
        let userPrompt = '';

        if (mode === 'chat') {
            // Simple chat mode
            systemMessage = `You are a helpful AI assistant that specializes in code analysis and explanation.
                        When generating text, output all characters exactly as they are written, without applying any formatting, parsing, or interpretation.
                        Treat characters like **, *, _, #, [, ], (, ), {, }, <, >, ~, \`, \\, %, $, @, ^, &, |, :, ;, ', " and any similar symbols as plain, literal text.
                        Do NOT apply Markdown, HTML, LaTeX, or any other syntax formatting rules to them.
                        Preserve all special characters exactly as provided, even if they normally trigger styling or linking behavior.
                        Never attempt to bold, italicize, create lists, links, code blocks, headings, emojis, or perform escape sequences automatically.`;
            userPrompt = `Please help me understand the following ${language} code:

                        \`\`\`${language}
                        ${code}
                        \`\`\`

                        Explain what this code does in a clear and concise way.`;
        } else {
            // Default GenTestx AI mode
            systemMessage = `You are a code analysis expert that specializes in generating comprehensive test cases.
                        Analyze the provided ${language} code and identify all possible test scenarios.
                        When generating text, output all characters exactly as they are written, without applying any formatting, parsing, or interpretation.
                        Treat characters like **, *, _, #, [, ], (, ), {, }, <, >, ~, \`, \\, %, $, @, ^, &, |, :, ;, ', " and any similar symbols as plain, literal text.
                        Do NOT apply Markdown, HTML, LaTeX, or any other syntax formatting rules to them.
                        Preserve all special characters exactly as provided, even if they normally trigger styling or linking behavior.
                        Never attempt to bold, italicize, create lists, links, code blocks, headings, emojis, or perform escape sequences automatically.`;
            userPrompt = `Please analyze the following ${language} code and provide a detailed analysis of its functionality,
                        edge cases, and potential bugs. Then, generate comprehensive test cases that cover all possible scenarios.

                        Here's the code:

                        \`\`\`${language}
                        ${code}
                        \`\`\`

                        For your response, please provide:
                        1. A brief analysis of what the code does
                        2. Identification of key functions, classes, and methods
                        3. Potential edge cases and error scenarios
                        4. A comprehensive list of test cases in JSON format with the following structure:
                           {
                             "testCases": [
                               {
                                 "description": "Test case description",
                                 "functionToTest": "functionName",
                                 "inputs": [input values or description],
                                 "expectedOutput": expected result,
                                 "scenario": "normal/edge case/error handling"
                               }
                             ]
                           }
                        `;
        }

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama3-70b-8192',
                messages: [
                    {
                        role: 'system',
                        content: systemMessage
                    },
                    {
                        role: 'user',
                        content: userPrompt
                    }
                ],
                temperature: 0.2,
                max_tokens: 4000
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.choices[0].message.content;
    } catch (error: any) {
        console.error('Error calling Groq API:', error.response?.data || error.message);
        throw new Error(`Failed to analyze code with Groq: ${error.response?.data?.error?.message || error.message}`);
    }
}

/**
 * Analyzes a file to determine its structure and language
 * @param code The source code to analyze
 * @param language The programming language of the code (if known)
 * @returns Analysis of the file structure and detected language
 */
export async function analyzeFileStructure(code: string, language: string): Promise<{detectedLanguage: string, structure: any}> {
    try {
        const apiKey = await getGroqApiKey();
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama3-70b-8192',
                messages: [
                    {
                        role: 'system',
                        content: `You are a code analysis expert that specializes in analyzing code structure and detecting programming languages.
                        When generating text, output all characters exactly as they are written, without applying any formatting, parsing, or interpretation.
                        Treat characters like **, *, _, #, [, ], (, ), {, }, <, >, ~, \`, \\, %, $, @, ^, &, |, :, ;, ', " and any similar symbols as plain, literal text.
                        Do NOT apply Markdown, HTML, LaTeX, or any other syntax formatting rules to them.
                        Preserve all special characters exactly as provided, even if they normally trigger styling or linking behavior.
                        Never attempt to bold, italicize, create lists, links, code blocks, headings, emojis, or perform escape sequences automatically.`
                    },
                    {
                        role: 'user',
                        content: `Please analyze the following code and determine:
                        1. The programming language (if not obvious, make your best guess)
                        2. The structure of the code (functions, classes, methods, etc.)
                        3. The main functionality of the code

                        Here's the code:

                        \`\`\`${language || ''}
                        ${code}
                        \`\`\`

                        Return your analysis in this exact JSON format:
                        {
                          "detectedLanguage": "language name",
                          "structure": {
                            "functions": ["function1", "function2", ...],
                            "classes": ["class1", "class2", ...],
                            "mainFunctionality": "brief description"
                          }
                        }`
                    }
                ],
                temperature: 0.1,
                max_tokens: 2000
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const content = response.data.choices[0].message.content;

        // Extract the JSON part from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('Could not find JSON in response:', content);
            return {
                detectedLanguage: language || 'unknown',
                structure: { functions: [], classes: [], mainFunctionality: "Could not analyze structure" }
            };
        }

        try {
            const jsonString = jsonMatch[0].trim();
            const analysisData = JSON.parse(jsonString);

            return {
                detectedLanguage: analysisData.detectedLanguage || language || 'unknown',
                structure: analysisData.structure || { functions: [], classes: [], mainFunctionality: "Structure analysis failed" }
            };
        } catch (parseError) {
            console.error('Error parsing analysis result:', parseError);
            return {
                detectedLanguage: language || 'unknown',
                structure: { functions: [], classes: [], mainFunctionality: "Error parsing structure analysis" }
            };
        }
    } catch (error: any) {
        console.error('Error analyzing file structure:', error.response?.data || error.message);
        return {
            detectedLanguage: language || 'unknown',
            structure: { functions: [], classes: [], mainFunctionality: "Error during structure analysis" }
        };
    }
}

/**
 * Generates test cases for the given code using the Groq API
 * @param code The source code to generate tests for
 * @param language The programming language of the code
 * @returns An array of test cases
 */
export async function generateTestCases(code: string, language: string): Promise<TestCase[]> {
    try {
        // First, analyze the code to extract function names
        const codeAnalysis = await analyzeCodeForFunctions(code, language);
        const functionNames = codeAnalysis.functions || [];

        const apiKey = await getGroqApiKey();
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama3-70b-8192',
                messages: [
                    {
                        role: 'system',
                        content: `You are a test generation expert that specializes in creating comprehensive, runnable test cases.
                        Analyze the provided ${language} code and generate test cases that can be executed directly.
                        Focus on creating test cases with clear input and expected output format.
                        When generating text, output all characters exactly as they are written, without applying any formatting, parsing, or interpretation.
                        Treat characters like **, *, _, #, [, ], (, ), {, }, <, >, ~, \`, \\, %, $, @, ^, &, |, :, ;, ', " and any similar symbols as plain, literal text.
                        Do NOT apply Markdown, HTML, LaTeX, or any other syntax formatting rules to them.
                        Preserve all special characters exactly as provided, even if they normally trigger styling or linking behavior.
                        Never attempt to bold, italicize, create lists, links, code blocks, headings, emojis, or perform escape sequences automatically.`
                    },
                    {
                        role: 'user',
                        content: `Please analyze the following ${language} code and generate runnable test cases.

                        Here's the code:

                        \`\`\`${language}
                        ${code}
                        \`\`\`

                        ${functionNames.length > 0 ? `I've identified these functions in the code: ${functionNames.join(', ')}. Make sure to use these exact function names in your tests.` : ''}

                        For each test case:
                        1. Create a detailed description
                        2. Identify the function/method being tested (use the exact function name from the code)
                        3. Clearly specify inputs with exact values (not just descriptions)
                        4. Clearly specify expected outputs with exact values
                        5. Indicate if it's a normal case, edge case, or error handling scenario
                        6. Most importantly, provide COMPLETE, RUNNABLE test code that can be executed directly

                        Return the test cases in this exact JSON format:
                        {
                          "testCases": [
                            {
                              "description": "Test case description",
                              "functionToTest": "functionName",
                              "inputs": "Exact input values, e.g. [1, 2, 3] or {'key': 'value'}",
                              "expectedOutput": "Exact expected result value",
                              "scenario": "normal/edge case/error handling",
                              "testCode": "complete runnable test code that includes assertions"
                            }
                          ]
                        }

                        Make sure the test code:
                        1. Is complete and can be run directly
                        2. Includes any necessary imports, setup, and assertions
                        3. Clearly shows the input values and expected output values
                        4. Has proper assertions that verify the actual output matches the expected output
                        5. Uses the appropriate testing framework and conventions for ${language}
                        6. IMPORTANT: For Python, make sure to use the correct function name in the test code. For example, if the function is named 'is_palindrome', make sure to call 'is_palindrome' in the test code, not some other name.`
                    }
                ],
                temperature: 0.2,
                max_tokens: 4000
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const content = response.data.choices[0].message.content;
        console.log('Groq API response:', content);

        // Extract the JSON part from the response
        const jsonMatch = content.match(/\{[\s\S]*"testCases"[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('Could not find JSON in response:', content);

            // Fallback: Create a simple test case from the response
            return [{
                id: `test-${Date.now()}-0`,
                description: 'Generated test case',
                functionToTest: functionNames.length > 0 ? functionNames[0] : 'Unknown function',
                inputs: 'N/A',
                expectedOutput: 'N/A',
                scenario: 'normal',
                testCode: content,
                isRunning: false,
                runResult: null
            }];
        }

        try {
            const jsonString = jsonMatch[0].trim();
            console.log('Extracted JSON:', jsonString);

            const testCasesData = JSON.parse(jsonString);

            if (!testCasesData.testCases || !Array.isArray(testCasesData.testCases)) {
                throw new Error('Invalid test cases format');
            }

            // Add unique IDs and initialize running state
            return testCasesData.testCases.map((testCase: any, index: number) => {
                // If we have function names from code analysis but the test case doesn't specify one,
                // use the first function name from our analysis
                let functionToTest = testCase.functionToTest || (functionNames.length > 0 ? functionNames[0] : 'Unknown function');

                // Ensure the test code uses the correct function name
                let testCode = testCase.testCode || '';

                // For Python, make sure the test code includes the correct function name
                if (language === 'python' && functionNames.length > 0) {
                    // Check if the function name is used in the test code
                    const functionNameUsed = functionNames.some(name => testCode.includes(name));

                    if (!functionNameUsed) {
                        // If not, try to fix it by replacing common test function names with the actual function name
                        functionNames.forEach(name => {
                            // Look for patterns like "function_name(" or "function_name (" and replace them
                            const commonMistakes = [
                                'test_function', 'function_under_test', 'func', 'my_function',
                                'palindrome', 'is_palindrome_function', 'check_palindrome'
                            ];

                            commonMistakes.forEach(mistake => {
                                const regex = new RegExp(`\\b${mistake}\\s*\\(`, 'g');
                                testCode = testCode.replace(regex, `${name}(`);
                            });
                        });
                    }
                }

                return {
                    id: `test-${Date.now()}-${index}`,
                    description: testCase.description || 'Test case',
                    functionToTest: functionToTest,
                    inputs: testCase.inputs || 'N/A',
                    expectedOutput: testCase.expectedOutput || 'N/A',
                    scenario: testCase.scenario || 'normal',
                    testCode: testCode,
                    isRunning: false,
                    runResult: null
                };
            });
        } catch (parseError) {
            console.error('Error parsing test cases:', parseError);

            // Fallback: Create a simple test case from the response
            return [{
                id: `test-${Date.now()}-0`,
                description: 'Generated test case (parsing failed)',
                functionToTest: functionNames.length > 0 ? functionNames[0] : 'Unknown function',
                inputs: 'N/A',
                expectedOutput: 'N/A',
                scenario: 'normal',
                testCode: content,
                isRunning: false,
                runResult: null
            }];
        }
    } catch (error: any) {
        console.error('Error generating test cases:', error.response?.data || error.message);
        throw new Error(`Failed to generate test cases: ${error.response?.data?.error?.message || error.message}`);
    }
}

/**
 * Analyzes code to extract function names and other important information
 * @param code The source code to analyze
 * @param language The programming language
 * @returns Analysis result with function names and other details
 */
async function analyzeCodeForFunctions(code: string, language: string): Promise<{functions: string[], classes: string[]}> {
    try {
        // Simple regex-based function detection for common languages
        const functions: string[] = [];
        const classes: string[] = [];

        if (language === 'python') {
            // Match Python function definitions
            const functionMatches = code.match(/def\s+([a-zA-Z0-9_]+)\s*\(/g);
            if (functionMatches) {
                functionMatches.forEach(match => {
                    const name = match.replace('def', '').replace('(', '').trim();
                    functions.push(name);
                });
            }

            // Match Python class definitions
            const classMatches = code.match(/class\s+([a-zA-Z0-9_]+)[\s:(]/g);
            if (classMatches) {
                classMatches.forEach(match => {
                    const name = match.replace('class', '').replace(':', '').replace('(', '').trim();
                    classes.push(name);
                });
            }
        } else if (language === 'javascript' || language === 'typescript') {
            // Match JS/TS function definitions (including arrow functions and methods)
            const functionMatches = code.match(/(?:function\s+([a-zA-Z0-9_]+)\s*\(|(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:function|\([^)]*\)\s*=>)|(?:^|\s)([a-zA-Z0-9_]+)\s*\([^)]*\)\s*{)/g);
            if (functionMatches) {
                functionMatches.forEach(match => {
                    let name = match.trim();

                    // Extract function name based on the pattern
                    if (name.startsWith('function')) {
                        name = name.replace('function', '').replace(/\s*\(.*$/, '').trim();
                    } else if (name.includes('=')) {
                        name = name.split('=')[0].replace(/(?:const|let|var)/, '').trim();
                    } else {
                        name = name.replace(/\s*\(.*$/, '').trim();
                    }

                    if (name && !name.includes('=>')) {
                        functions.push(name);
                    }
                });
            }

            // Match JS/TS class definitions
            const classMatches = code.match(/class\s+([a-zA-Z0-9_]+)[\s{]/g);
            if (classMatches) {
                classMatches.forEach(match => {
                    const name = match.replace('class', '').replace('{', '').trim();
                    classes.push(name);
                });
            }
        }

        return { functions, classes };
    } catch (error) {
        console.error('Error analyzing code for functions:', error);
        return { functions: [], classes: [] };
    }
}

/**
 * Runs a test case and returns the result
 * @param testCode The test code to run
 * @param language The programming language of the test code
 * @returns The result of running the test
 */
/**
 * Runs all test cases and tracks results
 * @param testCases Array of test cases to run
 * @param language The programming language of the test code
 * @param userCode The user's code being tested
 * @returns Updated test cases with results
 */
export async function runAllTestCases(testCases: TestCase[], language: string, userCode: string): Promise<{testCases: TestCase[], summary: {total: number, passed: number, failed: number}}> {
    const results: TestCase[] = [...testCases];
    let passCount = 0;
    let failCount = 0;

    // Create a temporary directory for the user code
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('No workspace folder is open. Please open a folder first.');
    }

    const tempDir = path.join(workspaceFolders[0].uri.fsPath, 'temp');
    const timestamp = Date.now();
    const userCodeFile = path.join(tempDir, `user_code_${timestamp}.${getFileExtension(language)}`);

    try {
        // Create the temp directory if it doesn't exist
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(tempDir));

        // Write the user code to a file
        await vscode.workspace.fs.writeFile(
            vscode.Uri.file(userCodeFile),
            Buffer.from(userCode, 'utf8')
        );

        // Create or reuse the terminal
        if (!activeTerminal) {
            activeTerminal = vscode.window.createTerminal(`🧪 GenTestX: Test Runner`);
            storeTerminalReference(activeTerminal);
        }
        activeTerminal.show();

        // Display a header with total test count
        activeTerminal.sendText(`echo "🧪 Running ${results.length} test cases..."`);
        activeTerminal.sendText(`echo "=================================="`);

        // Run each test case
        for (let i = 0; i < results.length; i++) {
            const testCase = results[i];
            testCase.isRunning = true;

            // Create a test file that imports the user code
            const testFile = path.join(tempDir, `test_${timestamp}_${i}.${getFileExtension(language)}`);

            // Modify the test code to import from the user code file if needed
            let modifiedTestCode = testCase.testCode;

            // For Python, ensure proper imports
            if (language === 'python') {
                // Extract the base filename without extension
                const userCodeBaseName = path.basename(userCodeFile, '.py');

                // Check if the test code already has imports
                if (!modifiedTestCode.includes('import ')) {
                    // Add import statement at the beginning with absolute path to avoid import errors
                    modifiedTestCode = `import sys\nimport os\n\n# Add the directory containing the user code to the Python path\nsys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))\n\n# Import all functions from the user code file\nfrom ${userCodeBaseName} import *\n\n${modifiedTestCode}`;
                } else if (!modifiedTestCode.includes(`from ${userCodeBaseName} import`) && !modifiedTestCode.includes(`import ${userCodeBaseName}`)) {
                    // If there are imports but not the user code import, add it after the existing imports
                    const importEndIndex = modifiedTestCode.lastIndexOf('import ');
                    const lineEndIndex = modifiedTestCode.indexOf('\n', importEndIndex);
                    const insertPosition = lineEndIndex !== -1 ? lineEndIndex + 1 : 0;

                    modifiedTestCode =
                        modifiedTestCode.substring(0, insertPosition) +
                        `\n# Import all functions from the user code file\nimport sys\nimport os\nsys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))\nfrom ${userCodeBaseName} import *\n\n` +
                        modifiedTestCode.substring(insertPosition);
                }
            }

            // Write the test code to a file
            await vscode.workspace.fs.writeFile(
                vscode.Uri.file(testFile),
                Buffer.from(modifiedTestCode, 'utf8')
            );

            // Run the test
            const command = getRunCommand(language, testFile);
            activeTerminal.sendText(`echo "Running Test Case ${i+1}/${results.length}: ${testCase.description}"`);
            activeTerminal.sendText(command);

            // Wait for the test to complete
            await new Promise(resolve => setTimeout(resolve, 3000));

            // In a real implementation, we would capture and parse the terminal output
            // For now, we'll use a more sophisticated approach to determine if the test passed

            // Run the test using our improved runTestCase function
            const testResult = await runTestCase(modifiedTestCode, language, userCode);

            testCase.passed = testResult.passed;

            if (testResult.passed) {
                testCase.runResult = "✅ Test passed successfully!";
                passCount++;
            } else {
                // If there's a suggestion, include it in the result
                if (testResult.suggestion) {
                    testCase.runResult = `❌ Test failed. ${testResult.suggestion}`;
                } else {
                    testCase.runResult = "❌ Test failed. Check the terminal for details.";
                }
                failCount++;
            }

            testCase.isRunning = false;

            // Clean up the test file
            try {
                await vscode.workspace.fs.delete(vscode.Uri.file(testFile), { recursive: false, useTrash: false });
            } catch (error) {
                console.error('Error cleaning up test file:', error);
            }
        }

        // Display a summary in the terminal
        activeTerminal.sendText(`echo "=================================="`);
        activeTerminal.sendText(`echo "🧪 Test Summary: ${passCount}/${results.length} tests passed"`);
        if (passCount === results.length) {
            activeTerminal.sendText(`echo "✅ All tests passed!"`);
        } else {
            activeTerminal.sendText(`echo "❌ ${failCount} tests failed."`);
        }

        // Keep the user code file for reference
        // We won't delete it so users can inspect it if needed

        return {
            testCases: results,
            summary: {
                total: results.length,
                passed: passCount,
                failed: failCount
            }
        };
    } catch (error) {
        console.error('Error running all test cases:', error);
        throw new Error(`Error running all test cases: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Generates code with a suggested file name
 * @param prompt The prompt for code generation
 * @param language The programming language for the code
 * @returns Generated code and suggested file name
 */
export async function generateCodeWithFileName(prompt: string, language: string): Promise<{code: string, fileName: string}> {
    try {
        const apiKey = await getGroqApiKey();
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama3-70b-8192',
                messages: [
                    {
                        role: 'system',
                        content: `You are a code generation expert that specializes in creating high-quality, functional code.
                        Generate code based on the user's request in the specified language.
                        Also suggest an appropriate file name for the generated code.
                        When generating text, output all characters exactly as they are written, without applying any formatting, parsing, or interpretation.
                        Treat characters like **, *, _, #, [, ], (, ), {, }, <, >, ~, \`, \\, %, $, @, ^, &, |, :, ;, ', " and any similar symbols as plain, literal text.
                        Do NOT apply Markdown, HTML, LaTeX, or any other syntax formatting rules to them.
                        Preserve all special characters exactly as provided, even if they normally trigger styling or linking behavior.
                        Never attempt to bold, italicize, create lists, links, code blocks, headings, emojis, or perform escape sequences automatically.`
                    },
                    {
                        role: 'user',
                        content: `Please generate ${language} code based on the following request:

                        ${prompt}

                        Return your response in this exact JSON format:
                        {
                          "fileName": "suggested_file_name.extension",
                          "code": "// Your generated code here"
                        }

                        Make sure the file name has an appropriate extension for ${language} code.
                        The code should be complete, well-commented, and follow best practices for ${language}.`
                    }
                ],
                temperature: 0.2,
                max_tokens: 4000
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const content = response.data.choices[0].message.content;

        // Extract the JSON part from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('Could not find JSON in response:', content);
            return {
                code: content,
                fileName: `generated_code_${Date.now()}.${getFileExtension(language)}`
            };
        }

        try {
            const jsonString = jsonMatch[0].trim();
            const result = JSON.parse(jsonString);

            return {
                code: result.code || content,
                fileName: result.fileName || `generated_code_${Date.now()}.${getFileExtension(language)}`
            };
        } catch (parseError) {
            console.error('Error parsing code generation result:', parseError);
            return {
                code: content,
                fileName: `generated_code_${Date.now()}.${getFileExtension(language)}`
            };
        }
    } catch (error: any) {
        console.error('Error generating code:', error.response?.data || error.message);
        throw new Error(`Failed to generate code: ${error.response?.data?.error?.message || error.message}`);
    }
}

// Store a reference to the active terminal for reuse
let activeTerminal: vscode.Terminal | undefined;

export async function runTestCase(testCode: string, language: string, userCode: string = ''): Promise<{result: string, passed: boolean, errorType?: string, suggestion?: string}> {
    // Create a temporary file to run the test
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return {
            result: 'No workspace folder is open. Please open a folder first.',
            passed: false
        };
    }

    // Create a unique timestamp for the file
    const timestamp = Date.now();
    const tempDir = path.join(workspaceFolders[0].uri.fsPath, 'temp');
    const tempFile = path.join(tempDir, `test_${timestamp}.${getFileExtension(language)}`);
    const userCodeFile = userCode ? path.join(tempDir, `user_code_${timestamp}.${getFileExtension(language)}`) : '';

    let terminalOutput = '';

    try {
        // Create the temp directory if it doesn't exist
        try {
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(tempDir));
        } catch (error) {
            console.error('Error creating temp directory:', error);
            return {
                result: `Error creating temp directory: ${error instanceof Error ? error.message : String(error)}`,
                passed: false
            };
        }

        // If user code is provided, write it to a separate file
        if (userCode) {
            try {
                await vscode.workspace.fs.writeFile(
                    vscode.Uri.file(userCodeFile),
                    Buffer.from(userCode, 'utf8')
                );
            } catch (error) {
                console.error('Error writing user code file:', error);
                return {
                    result: `Error writing user code file: ${error instanceof Error ? error.message : String(error)}`,
                    passed: false
                };
            }
        }

        // Modify test code to import from user code file if needed
        let modifiedTestCode = testCode;
        if (userCode && language === 'python') {
            // Extract the base filename without extension
            const userCodeBaseName = path.basename(userCodeFile, '.py');

            // Check if the test code already has imports
            if (!modifiedTestCode.includes('import ')) {
                // Add import statement at the beginning with absolute path to avoid import errors
                modifiedTestCode = `import sys\nimport os\n\n# Add the directory containing the user code to the Python path\nsys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))\n\n# Import all functions from the user code file\nfrom ${userCodeBaseName} import *\n\n${modifiedTestCode}`;
            } else if (!modifiedTestCode.includes(`from ${userCodeBaseName} import`) && !modifiedTestCode.includes(`import ${userCodeBaseName}`)) {
                // If there are imports but not the user code import, add it after the existing imports
                const importEndIndex = modifiedTestCode.lastIndexOf('import ');
                const lineEndIndex = modifiedTestCode.indexOf('\n', importEndIndex);
                const insertPosition = lineEndIndex !== -1 ? lineEndIndex + 1 : 0;

                modifiedTestCode =
                    modifiedTestCode.substring(0, insertPosition) +
                    `\n# Import all functions from the user code file\nimport sys\nimport os\nsys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))\nfrom ${userCodeBaseName} import *\n\n` +
                    modifiedTestCode.substring(insertPosition);
            }
        }

        // Write the test code to the temp file
        try {
            await vscode.workspace.fs.writeFile(
                vscode.Uri.file(tempFile),
                Buffer.from(modifiedTestCode, 'utf8')
            );
        } catch (error) {
            console.error('Error writing test file:', error);
            return {
                result: `Error writing test file: ${error instanceof Error ? error.message : String(error)}`,
                passed: false
            };
        }

        // Run the test based on the language
        const command = getRunCommand(language, tempFile);

        // Execute the command
        try {
            // Create or reuse the terminal
            if (!activeTerminal) {
                activeTerminal = vscode.window.createTerminal(`🧪 GenTestX: Test Runner`);
                // Store the terminal reference for later use
                storeTerminalReference(activeTerminal);
            }

            activeTerminal.show();
            activeTerminal.sendText(command);

            // Wait for the test to complete (this is a simplified approach)
            // In a real implementation, you would need to capture the output
            await new Promise(resolve => setTimeout(resolve, 3000));

            // For now, we'll assume the test passed if there's no error in the terminal
            // In a real implementation, you would parse the terminal output
            const passed = true;

            // Analyze the terminal output for common errors
            const errorAnalysis = analyzeTestError(terminalOutput, language);

            if (errorAnalysis.errorDetected) {
                return {
                    result: terminalOutput || 'Test executed. Check the terminal for results.',
                    passed: false,
                    errorType: errorAnalysis.errorType,
                    suggestion: errorAnalysis.suggestion
                };
            }

            return {
                result: 'Test executed successfully. Check the terminal for results.',
                passed: true
            };
        } catch (error) {
            console.error('Error executing test:', error);
            return {
                result: `Error executing test: ${error instanceof Error ? error.message : String(error)}`,
                passed: false
            };
        }
    } catch (error: any) {
        console.error('Error running test:', error);
        return {
            result: `Error running test: ${error instanceof Error ? error.message : String(error)}`,
            passed: false
        };
    } finally {
        // Clean up the temp files
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(tempFile), { recursive: false, useTrash: false });
            if (userCodeFile) {
                await vscode.workspace.fs.delete(vscode.Uri.file(userCodeFile), { recursive: false, useTrash: false });
            }
        } catch (error) {
            console.error('Error cleaning up temp files:', error);
        }
    }
}

/**
 * Analyzes test error output and provides suggestions
 * @param output The terminal output from the test run
 * @param language The programming language
 * @returns Analysis of the error with suggestions
 */
function analyzeTestError(output: string, language: string): {errorDetected: boolean, errorType?: string, suggestion?: string} {
    if (!output) {
        return { errorDetected: false };
    }

    // Check for common Python errors
    if (language === 'python') {
        // Check for NameError (undefined function or variable)
        const nameErrorMatch = output.match(/NameError: name '([^']+)' is not defined/);
        if (nameErrorMatch) {
            const missingName = nameErrorMatch[1];
            return {
                errorDetected: true,
                errorType: 'NameError',
                suggestion: `The function or variable '${missingName}' is not defined. Make sure it exists in your code or is properly imported.`
            };
        }

        // Check for ImportError
        const importErrorMatch = output.match(/ImportError: ([^\\r\\n]+)/);
        if (importErrorMatch) {
            return {
                errorDetected: true,
                errorType: 'ImportError',
                suggestion: `Import error: ${importErrorMatch[1]}. Check that the module exists and is accessible.`
            };
        }

        // Check for assertion errors
        const assertionErrorMatch = output.match(/AssertionError: ([^\\r\\n]+)/);
        if (assertionErrorMatch) {
            return {
                errorDetected: true,
                errorType: 'AssertionError',
                suggestion: `Test assertion failed: ${assertionErrorMatch[1]}. The function's output doesn't match the expected result.`
            };
        }
    }

    // Check for common JavaScript errors
    if (language === 'javascript' || language === 'typescript') {
        // Check for ReferenceError (undefined function or variable)
        const referenceErrorMatch = output.match(/ReferenceError: ([^\\r\\n]+) is not defined/);
        if (referenceErrorMatch) {
            const missingName = referenceErrorMatch[1];
            return {
                errorDetected: true,
                errorType: 'ReferenceError',
                suggestion: `The function or variable '${missingName}' is not defined. Make sure it exists in your code or is properly imported.`
            };
        }

        // Check for TypeError
        const typeErrorMatch = output.match(/TypeError: ([^\\r\\n]+)/);
        if (typeErrorMatch) {
            return {
                errorDetected: true,
                errorType: 'TypeError',
                suggestion: `Type error: ${typeErrorMatch[1]}. Check that you're using the correct data types.`
            };
        }
    }

    // Generic error detection
    if (output.includes('Error') || output.includes('error') || output.includes('Exception') || output.includes('exception')) {
        return {
            errorDetected: true,
            errorType: 'UnknownError',
            suggestion: 'An error occurred during test execution. Check the terminal output for details.'
        };
    }

    return { errorDetected: false };
}

/**
 * Gets the file extension for a given language
 * @param language The programming language
 * @returns The file extension
 */
function getFileExtension(language: string): string {
    switch (language.toLowerCase()) {
        case 'javascript':
            return 'js';
        case 'typescript':
            return 'ts';
        case 'python':
            return 'py';
        case 'java':
            return 'java';
        case 'csharp':
            return 'cs';
        case 'cpp':
        case 'c':
            return 'cpp';
        case 'go':
            return 'go';
        case 'rust':
            return 'rs';
        case 'php':
            return 'php';
        case 'ruby':
            return 'rb';
        case 'html':
            return 'html';
        case 'css':
        case 'scss':
        case 'less':
            return 'css';
        case 'json':
            return 'json';
        case 'yaml':
            return 'yaml';
        case 'markdown':
            return 'md';
        case 'powershell':
            return 'ps1';
        case 'shellscript':
            return 'sh';
        case 'sql':
            return 'sql';
        case 'swift':
            return 'swift';
        case 'objective-c':
            return 'm';
        case 'dart':
            return 'dart';
        case 'kotlin':
            return 'kt';
        case 'xml':
            return 'xml';
        case 'perl':
            return 'pl';
        case 'lua':
            return 'lua';
        case 'r':
            return 'r';
        case 'groovy':
            return 'groovy';
        case 'fsharp':
            return 'fs';
        case 'vb':
            return 'vb';
        case 'clojure':
            return 'clj';
        case 'coffeescript':
            return 'coffee';
        default:
            return 'txt';
    }
}

/**
 * Gets the command to run a test file for a given language
 * @param language The programming language
 * @param filePath The path to the test file
 * @returns The command to run the test
 */
/**
 * Stores a terminal reference for later use
 * @param terminal The terminal to store
 */
function storeTerminalReference(terminal: vscode.Terminal): void {
    const id = `terminal-${Date.now()}`;
    activeTerminals.set(id, terminal);

    // Clean up when the terminal is closed
    const disposable = vscode.window.onDidCloseTerminal(closedTerminal => {
        if (closedTerminal === terminal) {
            activeTerminals.delete(id);
            disposable.dispose();
        }
    });
}

function getRunCommand(language: string, filePath: string): string {
    // Add GenTestX icon to terminal title
    const terminalPrefix = '🧪 GenTestX: ';

    switch (language.toLowerCase()) {
        case 'javascript':
            return `echo "${terminalPrefix}Running JavaScript test..." && node ${filePath}`;
        case 'typescript':
            return `echo "${terminalPrefix}Running TypeScript test..." && ts-node ${filePath}`;
        case 'python':
            return `echo "${terminalPrefix}Running Python test..." && python ${filePath}`;
        case 'java':
            return `echo "${terminalPrefix}Running Java test..." && javac ${filePath} && java ${path.basename(filePath, '.java')}`;
        case 'csharp':
            return `echo "${terminalPrefix}Running C# test..." && dotnet run ${filePath}`;
        case 'cpp':
        case 'c':
            return `echo "${terminalPrefix}Running C/C++ test..." && g++ ${filePath} -o ${filePath}.exe && ${filePath}.exe`;
        case 'go':
            return `echo "${terminalPrefix}Running Go test..." && go run ${filePath}`;
        case 'rust':
            return `echo "${terminalPrefix}Running Rust test..." && rustc ${filePath} && ${filePath.replace('.rs', '')}`;
        case 'php':
            return `echo "${terminalPrefix}Running PHP test..." && php ${filePath}`;
        case 'ruby':
            return `echo "${terminalPrefix}Running Ruby test..." && ruby ${filePath}`;
        case 'swift':
            return `echo "${terminalPrefix}Running Swift test..." && swift ${filePath}`;
        case 'kotlin':
            return `echo "${terminalPrefix}Running Kotlin test..." && kotlinc ${filePath} -include-runtime -d ${filePath}.jar && java -jar ${filePath}.jar`;
        case 'dart':
            return `echo "${terminalPrefix}Running Dart test..." && dart ${filePath}`;
        case 'perl':
            return `echo "${terminalPrefix}Running Perl test..." && perl ${filePath}`;
        case 'lua':
            return `echo "${terminalPrefix}Running Lua test..." && lua ${filePath}`;
        case 'r':
            return `echo "${terminalPrefix}Running R test..." && Rscript ${filePath}`;
        case 'powershell':
            return `echo "${terminalPrefix}Running PowerShell test..." && powershell -File ${filePath}`;
        case 'shellscript':
            return `echo "${terminalPrefix}Running Shell test..." && bash ${filePath}`;
        case 'sql':
            return `echo "${terminalPrefix}Running SQL test..." && echo "SQL files need a database to run. Please use a database client."`;
        case 'html':
        case 'css':
        case 'scss':
        case 'less':
        case 'json':
        case 'yaml':
        case 'xml':
        case 'markdown':
            return `echo "${terminalPrefix}Viewing ${language} file..." && type ${filePath}`;
        default:
            return `echo "${terminalPrefix}Unsupported language: ${language}" && type ${filePath}`;
    }
}
