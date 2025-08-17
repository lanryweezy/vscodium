# Weezy AI Agent - Testing Plan

This document provides a comprehensive plan for testing the Weezy AI agent application. Since the agent cannot test itself, these steps should be followed manually to verify that all features are working as expected.

## Part 1: Build and Run Instructions

Follow these steps to build the application from source and package it for your operating system.

### Prerequisites

Before you begin, ensure you have the following installed on your system:
- **Node.js**: A recent version (e.g., v18.x or later).
- **npm**: Should be included with Node.js.
- **Python**: A recent version of Python 3 (e.g., 3.8 or later).
- **pip**: Should be included with Python.
- **Required Python Packages**: Make sure you have `virtualenv` installed (`pip install virtualenv`). The build script may also require other system-level build tools depending on your OS (e.g., `build-essential` on Debian/Ubuntu, Xcode Command Line Tools on macOS).
- **Ollama**: You must have Ollama running locally for the AI agents to function. Make sure you have pulled the `codellama` model by running `ollama pull codellama`.

### Build Steps

1.  **Clone the Repository:**
    If you haven't already, clone the repository to your local machine.

2.  **Run the Main Build Script:**
    Open a terminal in the root of the repository and run the main build script. This will check out the VS Code source, apply all of our custom patches, and compile the entire application.
    ```bash
    ./build.sh
    ```
    This step can take a significant amount of time. It will create a `vscode` directory and a build output directory (e.g., `VSCode-linux-x64`).

3.  **Run the Packaging Script:**
    After the build script finishes successfully, navigate into the `vscode` directory and run the packaging script. This uses `electron-builder` to create the final application installer.
    ```bash
    cd vscode
    npm run package
    ```

### Running the Application

After the packaging is complete, you will find the distributable application inside the `vscode/dist/` directory.
-   On **Linux**, this might be a `.AppImage` or `.deb` file.
-   On **Windows**, this will be a `.exe` installer.
-   On **macOS**, this will be a `.dmg` file.

Install and run the application as you would any other program on your system. Once it's running, you can open the AI Assistant panel (check the View > Appearance or View > Open View... menus) to begin testing.

## Part 2: Test Cases

For each test case, create a new empty folder and open it in Weezy before starting.

### Test Case 1: Happy Path Workflow

This test verifies that the entire workflow runs successfully from start to finish on a simple request.

**1. User Input:**
In the AI Assistant panel, type the following request:
```
Create a simple python utility with a function that takes a name as a string and returns a greeting message.
```

**2. Expected Agent Workflow (as seen in the chat/log panel):**
-   The `SupervisorAgent` will start, initialize a project, and delegate to `ProductAgent`.
-   `ProductAgent` will create a `SPECIFICATION.md` file and delegate back.
-   `SupervisorAgent` will ask for your approval for the spec. **You should type `approve` and send.**
-   `SupervisorAgent` will delegate to `TechLeadAgent`.
-   `TechLeadAgent` will create `ARCHITECTURE_PLAN.md` and `requirements.txt` and delegate back.
-   `SupervisorAgent` will delegate to `PMBot`.
-   `PMBot` will create tasks in `PROJECT_TASKS.json` and delegate back.
-   `SupervisorAgent` will delegate the development task to `DeveloperAgent`.
-   `DeveloperAgent` will create two files (e.g., `utils.py` and `test_utils.py`) and update the task status to `in_testing`.
-   `SupervisorAgent` will delegate to `TesterAgent`.
-   `TesterAgent` will report success for linting and unit tests.
-   `SupervisorAgent` will delegate to `RefactorAgent`.
-   `RefactorAgent` will make some small improvements and delegate back.
-   `SupervisorAgent` will delegate back to `TesterAgent` for a re-test, which should pass.
-   `SupervisorAgent` will delegate to `SecurityAgent`, which should report success.
-   `SupervisorAgent` will delegate to `DocsAgent`.
-   `DocsAgent` will update the `README.md` file.
-   `SupervisorAgent` will update the task status to `done`.
-   `SupervisorAgent` will provide a final summary message to you.

**3. Verification:**
After the run is complete, check the following in your project folder:
-   `SPECIFICATION.md`: Exists and describes the greeting function.
-   `ARCHITECTURE_PLAN.md`: Exists and outlines the plan.
-   `requirements.txt`: Exists and contains `pytest` and `bandit`.
-   `PROJECT_TASKS.json`: Exists and the main development task has a status of `done`.
-   `utils.py` (or similar): Exists and contains a Python function like `def greet(name): return f"Hello, {name}!"`.
-   `test_utils.py` (or similar): Exists and contains a pytest test that checks the `greet` function.
-   `README.md`: Has been updated with a new section describing the greeting utility.

### Test Case 2: Test Failure & Fix Loop

This test verifies that the system can detect a unit test failure, attempt a fix, and re-test successfully.

**1. User Input:**
```
Create a Python function that takes a list of numbers and returns a new list containing only the even numbers.
```
*Note: This is a common task where an LLM might make a mistake in the list comprehension or iteration.*

**2. Expected Agent Workflow:**
- The initial workflow will proceed as in the Happy Path up until the `TesterAgent` runs for the first time.
- **Expected Failure:** The `TesterAgent` will likely report that the unit test failed (e.g., `AssertionError`). The log should show the `overall_status` as `'failure'` in the test report.
- The `SupervisorAgent` will receive the failure and delegate to the `DeveloperAgent` for a fix, mentioning a `retry_count`.
- The `DeveloperAgent` will receive the `test_report`, read the code and the error, and attempt a fix using `file.edit` or `code.modify`.
- The `SupervisorAgent` will receive the fix summary and delegate back to the `TesterAgent` for a re-test.
- The `TesterAgent` will run the tests again. This time, they should pass.
- The workflow will then continue through Security, Docs, etc., as normal.

**3. Verification:**
- Observe the agent activity in the chat log to confirm the fail -> fix -> re-test loop occurs.
- Check the final generated code (e.g., `evens.py`) to ensure it is correct (e.g., `return [num for num in numbers if num % 2 == 0]`).

### Test Case 3: Security Failure & Fix Loop

This test verifies the security scan and fix loop.

**1. User Input:**
```
Create a Python function that serializes a Python object to a file using the pickle module.
```

**2. Expected Agent Workflow:**
- The workflow will proceed as in the Happy Path, including passing the initial tests.
- **Expected Failure:** When the `SupervisorAgent` delegates to the `SecurityAgent`, the `security.scanFile` tool (using `bandit`) will flag the use of `pickle` as a high-severity vulnerability. The agent will report a `status: 'failure'`.
- The `SupervisorAgent` will delegate this `security_report` to the `DeveloperAgent` for a fix.
- The `DeveloperAgent` should attempt to replace `pickle` with a safer alternative, like `json`, using `file.edit` or `code.modify`.
- The `SupervisorAgent` will delegate the modified file back to the `SecurityAgent` for a re-scan.
- The re-scan should now pass, and the workflow will continue.

**3. Verification:**
- Observe the agent activity to confirm the Test (Pass) -> Secure (Fail) -> Fix -> Re-Scan (Pass) loop.
- Check the final code to see that it uses the `json` module instead of `pickle`.

### Test Case 4: Advanced Error Recovery (User Guidance)

This test verifies that the Supervisor asks for help when it gets stuck.

**1. User Input:**
- Use the same input as **Test Case 2**: `Create a Python function that takes a list of numbers and returns a new list containing only the even numbers.`

**2. Triggering the Failure Loop:**
- This is the tricky part. You need the `DeveloperAgent`'s fix to fail repeatedly. If the agent fixes the bug on the first try, the loop won't hit its limit.
- **Method to force failure:** After the `DeveloperAgent` attempts its first fix (you'll see the file get modified), you can *manually* edit the file in the workspace and re-introduce the bug before the `TesterAgent` runs the re-test. You will need to be quick. Do this twice.
- After the second failed re-test, the `SupervisorAgent`'s `retry_count` will be at its limit.

**3. Expected Agent Workflow:**
- **Expected Prompt:** The `SupervisorAgent` will use `user.requestInput` and you will see a message in the panel asking for guidance, with options like:
  ```
  The agent failed to fix the test issues after 2 attempts. How should I proceed? (Reply with A, B, or C)
  [A] Try to fix it one more time.
  [B] Skip the issue, mark task as 'done_with_errors'.
  [C] Abort the entire process.
  ```
- **Your Action:** Respond by typing `B` and sending the message.

**4. Verification:**
- The `SupervisorAgent` should proceed with the workflow.
- Check the `PROJECT_TASKS.json` file. The status of the relevant development task should be `done_with_errors`.
- The final summary message from the Supervisor should indicate that the task was completed with errors.

### Test Case 5: Dependency Management

This test verifies that the `DeveloperAgent` can identify, add, and install a new third-party dependency.

**1. User Input:**
```
Create a python function that makes a GET request to `https://api.publicapis.org/entries` and returns the status code.
```

**2. Expected Agent Workflow:**
- The workflow will proceed as normal until the `DeveloperAgent`'s turn.
- The `DeveloperAgent` should first use the `dependency.add` tool with `package_name: 'requests'`. You should see this in the activity log.
- After the dependency is installed, the agent will then use `file.write` to create the Python file (e.g., `api_client.py`) which `import`s and uses the `requests` library.
- It will then create a test file. The test file might use mocking to avoid making a real network call, or it might make a real one.
- The rest of the workflow should proceed successfully.

**3. Verification:**
- Check that `requirements.txt` now contains a line for `requests`.
- Check that the generated Python code contains `import requests`.
- Verify that the unit tests pass, indicating the dependency was correctly installed and is usable.

### Test Case 6: User Approval (Rejection)

This test verifies that the workflow correctly halts if the user does not approve the initial specification.

**1. User Input:**
Use the same input as **Test Case 1**: `Create a simple python utility with a function that takes a name as a string and returns a greeting message.`

**2. Expected Agent Workflow:**
- The `SupervisorAgent` will start and delegate to `ProductAgent`.
- `ProductAgent` will create `SPECIFICATION.md`.
- `SupervisorAgent` will use `user.requestInput` to ask for your approval.
- **Your Action:** Respond by typing anything other than `approve`. For example, type `No, change the greeting to be more formal.`

**3. Verification:**
- The `SupervisorAgent` should respond with a message indicating that it has received your feedback but cannot automatically act on it yet, and that the process is halting.
- No further agent activity should occur. No `TechLeadAgent` or `DeveloperAgent` should be invoked. The process should stop gracefully.
